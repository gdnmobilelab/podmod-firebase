import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer, Server } from "../../src/index";
import Environment from "../../src/util/env";
import { subscribeUserNock, unsubscribeUserNock } from "../endpoints/subscribe";
import { portIntoLogsQuery, portIntoCurrentSubscribersQuery } from "../../migrations/1531948410830_subscription-log";
import { withDBClient } from "../../src/util/db";

describe("Migrations", () => {
  let server: Server;

  before(async () => {
    server = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await server.stop();
  });

  it("Should successfully port data to new log tables", async () => {
    // Two users. One will subscribe, unsubscribe, then subscribe. Two will subscribe
    // then unsubscribe.

    let sub = subscribeUserNock("TEST_USER", "TEST_TOPIC");
    let sub2 = subscribeUserNock("TEST_USER2", "TEST_TOPIC");
    let unsub = unsubscribeUserNock("TEST_USER", "TEST_TOPIC");
    let unsub2 = unsubscribeUserNock("TEST_USER2", "TEST_TOPIC");

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    sub.done();

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER2", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    sub2.done();

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "DELETE",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    unsub.done();

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER2", {
      method: "DELETE",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    unsub2.done();

    sub = subscribeUserNock("TEST_USER", "TEST_TOPIC");

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY,
        "content-type": "application/json"
      }
    });

    sub.done();

    // This is really annoying, but we need to make sure the log -> DB stream has flushed.
    await new Promise(fulfill => setTimeout(fulfill, 100));

    // check against this later

    await withDBClient(async client => {
      let existingData = await client.query("SELECT * FROM subscription_log");
      let existingRows = existingData.rows.sort((a, b) => a.time - b.time);
      // now clean out the log table, so we can manually repopulate it
      await client.query("DELETE FROM subscription_log");
      await client.query(portIntoLogsQuery);

      let newData = await client.query("SELECT * FROM subscription_log");
      let newRows = newData.rows.sort((a, b) => a.time - b.time);

      expect(newRows.length).to.eq(existingRows.length);

      newRows.forEach((newRow, idx) => {
        let existingRow = existingRows[idx];

        expect(newRow.action).to.eq(existingRow.action);
        expect(newRow.firebase_id).to.eq(existingRow.firebase_id);
        expect(newRow.topic_id).to.eq(existingRow.topic_id);
      });

      // Now port these subscriptions into the current subscription table. Again, first clear out
      // existing data. TRUNCATE does not fire our triggers:

      await client.query("TRUNCATE TABLE currently_subscribed");

      await client.query(portIntoCurrentSubscribersQuery);

      let result = await client.query("SELECT * FROM currently_subscribed");
      expect(result.rowCount).to.eq(1);
      expect(result.rows[0].firebase_id).to.eq("TEST_USER");
    });

    sub.done();
  });
});
