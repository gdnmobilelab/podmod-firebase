import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer, Server } from "../../src/index";
import Environment from "../../src/util/env";
import { subscribeUserNock, unsubscribeUserNock } from "./subscribe";
import { withDBClient } from "../../src/util/db";

describe.only("Topic Details", () => {
  let server: Server;

  before(async () => {
    server = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await server.stop();
  });

  it("Should show subscriber and unsubscriber totals", async () => {
    let res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(json.subscribers.subscribes).to.eq(0);
    expect(json.subscribers.unsubscribes).to.eq(0);
    expect(json.subscribers.currentlySubscribed).to.eq(0);
  });

  it("Should reflect subscribes and unsubscribes in totals", async () => {
    let sub = subscribeUserNock("TEST_USER", "TEST_TOPIC");
    let unsub = unsubscribeUserNock("TEST_USER", "TEST_TOPIC");

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    let res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(json.subscribers.subscribes).to.eq(1, "Subscribes should equal 1");
    expect(json.subscribers.unsubscribes).to.eq(0, "Unsubscribes should equal 0");
    expect(json.subscribers.currentlySubscribed).to.eq(1, "Current subscribers should equal 1");

    sub.done();

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "DELETE",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    json = await res.json();
    expect(json.subscribers.subscribes).to.eq(1, "Subscribes should equal 1");
    expect(json.subscribers.unsubscribes).to.eq(1, "Unsubscribes should equal 1");
    expect(json.subscribers.currentlySubscribed).to.eq(0, "Current subscribers should equal 0");

    unsub.done();

    sub = subscribeUserNock("TEST_USER", "TEST_TOPIC");
    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    json = await res.json();
    expect(json.subscribers.subscribes).to.eq(1, "Subscribes should equal 1");
    expect(json.subscribers.unsubscribes).to.eq(1, "Unsubscribes should equal 1");
    expect(json.subscribers.currentlySubscribed).to.eq(1, "Current subscribers should equal 1");
    sub.done();
  });

  it("Should return a list of subscribed tokens", async () => {
    let sub = subscribeUserNock("TEST_USER", "TEST_TOPIC");
    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });
    sub.done();

    let res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers", {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(res.status).to.eq(200);
    expect(json.length).to.eq(1);
    expect(json[0]).to.eq("TEST_USER");
  });

  it("Should page results list correctly", async () => {
    let values: string[] = [];
    for (let x = 1; x <= 1001; x++) {
      values.push(`('TEST_TOPIC','TEST_USER_${x}')`);
    }

    await withDBClient(c =>
      c.query("INSERT INTO currently_subscribed (topic_id, firebase_id) VALUES " + values.join(","))
    );

    let res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers", {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(json.length).to.eq(1000);
    for (let x = 0; x < json.length; x++) {
      expect(json[x]).to.eq("TEST_USER_" + (x + 1));
    }

    res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers?page=2", {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    json = await res.json();
    expect(json.length).to.eq(1);
    expect(json[0]).to.eq("TEST_USER_1001");
  });

  it("Should skip results list correctly", async () => {
    let values: string[] = [];
    for (let x = 1; x <= 1001; x++) {
      values.push(`('TEST_TOPIC','TEST_USER_${x}')`);
    }

    await withDBClient(c =>
      c.query("INSERT INTO currently_subscribed (topic_id, firebase_id) VALUES " + values.join(","))
    );

    let res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers", {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(json.length).to.eq(1000);
    for (let x = 0; x < json.length; x++) {
      expect(json[x]).to.eq("TEST_USER_" + (x + 1));
    }

    res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers?skip=1000", {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    json = await res.json();
    expect(json.length).to.eq(1);
    expect(json[0]).to.eq("TEST_USER_1001");
  });
});
