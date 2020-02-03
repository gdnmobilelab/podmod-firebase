import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer, Server } from "../../src/index";
import { sendMessageNock } from "./send-message";
import { namespaceTopic } from "../../src/util/namespace";
import { withDBClient } from "../../src/util/db";

interface BulkOperationStub {
  id: string;
  error?: string;
}

export function bulkOperationNock(operation: "batchAdd" | "batchRemove", userIds: BulkOperationStub[], topic: string) {
  return nock("https://iid.googleapis.com", {
    reqheaders: {
      "Content-Type": "application/json",
      authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
    }
  })
    .post(`/iid/v1:${operation}`, {
      to: `/topics/${namespaceTopic(topic)}`,
      registration_tokens: userIds.map(u => u.id)
    })
    .reply(200, {
      results: userIds.map(u => {
        return { error: u.error };
      })
    });
}

xdescribe("Bulk subscription operations", () => {
  let server: Server;

  before(async () => {
    server = await createServer();
  });

  after(async function() {
    nock.cleanAll();
    console.log("server stop");
    await server.stop();
    console.log("server stopped");
  });

  it("Should subscribe users in bulk", async () => {
    const topic = "TEST_TOPIC";

    const users = [];

    for (let i = 0; i < 1000; i++) {
      users.push({ id: `TEST_USER${i}` });
    }

    let nocked = bulkOperationNock("batchAdd", users, "TEST_TOPIC");

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: users.map(u => u.id)
      })
    });

    let json = await res.json();

    expect(res.status).to.eq(200);
    expect(json.errors.length).to.eq(0);

    let result = await withDBClient(c =>
      c.query("SELECT * from currently_subscribed WHERE topic_id = $1 ORDER BY firebase_id ASC", [topic])
    );
    expect(result.rowCount).to.eq(1000);

    for (let i = 0; i < 1000; i++) {
      let row = result.rows.find(r => r.firebase_id === `TEST_USER${i}`);
      expect(row).to.exist;
      expect(row.topic_id).to.eq("TEST_TOPIC");
    }

    nocked.done();
  });

  it("Should bulk subscribe when duplicate IDs exist", async () => {
    const topic = "TEST_TOPIC";

    const users = [
      {
        id: "TEST_USER"
      },
      {
        id: "TEST_USER"
      },
      {
        id: "TEST_USER2"
      }
    ];

    let nocked = bulkOperationNock("batchAdd", [{ id: "TEST_USER" }, { id: "TEST_USER2" }], "TEST_TOPIC");

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: users.map(u => u.id)
      })
    });

    let json = await res.json();

    expect(res.status).to.eq(200);
    expect(json.errors.length).to.eq(0);
    expect(json.warnings.length).to.eq(1);
    expect(json.warnings[0].id).to.eq("TEST_USER");

    nocked.done();

    let result = await withDBClient(c =>
      c.query("SELECT * from currently_subscribed WHERE topic_id = $1 ORDER BY firebase_id ASC", [topic])
    );
    expect(result.rowCount).to.eq(2);
  });

  it("Should be able to use the same ID twice in different operations", async () => {
    let nocked = bulkOperationNock("batchAdd", [{ id: "TEST_USER" }], "TEST_TOPIC");

    await fetch(`http://localhost:3000/topics/TEST_TOPIC/subscribers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: ["TEST_USER"]
      })
    });

    nocked.done();
    nocked = bulkOperationNock("batchAdd", [{ id: "TEST_USER" }], "TEST_TOPIC");

    let res = await fetch(`http://localhost:3000/topics/TEST_TOPIC/subscribers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: ["TEST_USER"]
      })
    });

    let json = await res.json();
    expect(res.status).to.eq(200);
  });

  it("Should unsubscribe users in bulk", async () => {
    const topic = "TEST_TOPIC";

    const users = [
      {
        id: "TEST_USER"
      },
      {
        id: "TEST_USER2"
      }
    ];

    // Add users first, so we can check the database operations work
    await withDBClient(c =>
      c.query(`
      INSERT INTO currently_subscribed (firebase_id, topic_id)
      VALUES ('TEST_USER', 'TEST_TOPIC'), ('TEST_USER2', 'TEST_TOPIC')
      `)
    );

    let nocked = bulkOperationNock("batchRemove", users, "TEST_TOPIC");

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: users.map(u => u.id)
      })
    });

    let json = await res.json();
    expect(res.status).to.eq(200);
    expect(json.errors.length).to.eq(0);
    nocked.done();

    let result = await withDBClient(c =>
      c.query("SELECT * from currently_subscribed WHERE firebase_id IN ($1,$2) AND topic_id = $3", [
        "TEST_USER",
        "TEST_USER2",
        topic
      ])
    );
    expect(result.rowCount).to.eq(0);
  });

  it("Should record successful subscribes and return failed ones", async () => {
    const topic = "TEST_TOPIC";

    const users = [
      {
        id: "TEST_USER",
        error: "NOT_FOUND"
      },
      {
        id: "TEST_USER2"
      }
    ];

    let subnock = bulkOperationNock("batchAdd", users, "TEST_TOPIC");
    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: users.map(u => u.id)
      })
    });

    subnock.done();

    let json = await res.json();
    expect(json.errors.length).to.eq(1);
    expect(json.errors[0].id).to.eq("TEST_USER");
    expect(json.errors[0].error).to.eq("NOT_FOUND");

    let result = await withDBClient(c =>
      c.query("SELECT * from currently_subscribed WHERE firebase_id IN ($1,$2) AND topic_id = $3", [
        "TEST_USER",
        "TEST_USER2",
        topic
      ])
    );
    expect(result.rowCount).to.eq(1);
    expect(result.rows[0].firebase_id).to.eq("TEST_USER2");
  });

  it("Should record successful unsubscribes and return failed ones", async () => {
    const topic = "TEST_TOPIC";

    const users = [
      {
        id: "TEST_USER",
        error: "NOT_FOUND"
      },
      {
        id: "TEST_USER2"
      }
    ];

    // Add users first, so we can check the database operations work
    await withDBClient(c =>
      c.query(`
      INSERT INTO currently_subscribed (firebase_id, topic_id)
      VALUES ('TEST_USER', 'TEST_TOPIC'), ('TEST_USER2', 'TEST_TOPIC')
      `)
    );

    // Subscriber users first, so we can check the database operations work
    let remnock = bulkOperationNock("batchRemove", users, "TEST_TOPIC");
    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        ids: users.map(u => u.id)
      })
    });

    remnock.done();

    let json = await res.json();
    expect(json.errors.length).to.eq(1);
    expect(json.errors[0].id).to.eq("TEST_USER");
    expect(json.errors[0].error).to.eq("NOT_FOUND");

    let result = await withDBClient(c =>
      c.query("SELECT * from currently_subscribed WHERE firebase_id IN ($1,$2) AND topic_id = $3", [
        "TEST_USER",
        "TEST_USER2",
        topic
      ])
    );
    expect(result.rowCount).to.eq(1);
    expect(result.rows[0].firebase_id).to.eq("TEST_USER");
  });
});
