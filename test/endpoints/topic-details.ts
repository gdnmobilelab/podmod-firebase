import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer } from "../../src/index";
import Environment from "../../src/util/env";
import { subscribeUserNock, unsubscribeUserNock } from "./subscribe";

describe("Topic Details", () => {
  let stop: () => void;

  before(async () => {
    stop = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await stop();
  });

  it("Should show subscribers and unsubscribers", async () => {
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

  it("Should reflect subscribes and unsubscribes", async () => {
    let sub = subscribeUserNock("TEST_USER", "TEST_TOPIC");
    let unsub = unsubscribeUserNock("TEST_USER", "TEST_TOPIC");

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "POST",
      headers: {
        authorization: Environment.USER_API_KEY
      }
    });

    let res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(json.subscribers.subscribes).to.eq(1);
    expect(json.subscribers.unsubscribes).to.eq(0);
    expect(json.subscribers.currentlySubscribed).to.eq(1);

    sub.done();

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "DELETE",
      headers: {
        authorization: Environment.USER_API_KEY
      }
    });

    res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    json = await res.json();
    expect(json.subscribers.subscribes).to.eq(1);
    expect(json.subscribers.unsubscribes).to.eq(1);
    expect(json.subscribers.currentlySubscribed).to.eq(0);

    unsub.done();
  });

  xit("Should not reflect an unsubscribe without a corresponding subscribe", async () => {
    // future improvement maybe?
    let unsub = unsubscribeUserNock("TEST_USER", "TEST_TOPIC");

    await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers/TEST_USER", {
      method: "DELETE",
      headers: {
        authorization: Environment.USER_API_KEY
      }
    });

    let res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    let json = await res.json();
    expect(json.subscribers.subscribes).to.eq(0);
    expect(json.subscribers.unsubscribes).to.eq(0);
    expect(json.subscribers.currentlySubscribed).to.eq(0);

    unsub.done();
  });
});
