import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer } from "../../src/index";

export function subscribeUserNock(userId: string, topic: String) {
  return nock("https://iid.googleapis.com", {
    reqheaders: {
      "Content-Type": "application/json",
      authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
    }
  })
    .post(`/iid/v1/${userId}/rel/topics/_${process.env.NODE_ENV}_${topic}`)
    .reply(200, {});
}

export function unsubscribeUserNock(userId: string, topic: String) {
  return nock("https://iid.googleapis.com", {
    reqheaders: {
      "Content-Type": "application/json",
      authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
    }
  })
    .delete(`/iid/v1/${userId}/rel/topics/_${process.env.NODE_ENV}_${topic}`)
    .reply(200, {});
}

describe("Toggle subscription state", () => {
  let stop: () => void;

  before(async () => {
    stop = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await stop();
  });

  it("It should subscribe a user", async () => {
    const topic = "TEST_TOPIC";
    const userId = "TEST_USER_ID";

    let nocked = subscribeUserNock(userId, topic);

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers/${userId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: "{}"
    });

    expect(res.status).to.eq(200);
    let json = await res.json();

    expect(json.subscribed).to.eq(true);

    nocked.done();
  });

  it("It should fail when passing a non-existent token", async () => {
    const topic = "TEST_TOPIC";
    const userId = "TEST_USER_ID";

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        "Content-Type": "application/json",
        authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
      }
    })
      .post(`/iid/v1/${userId}/rel/topics/_${process.env.NODE_ENV}_${topic}`)
      .reply(
        400,
        JSON.stringify({
          error: "InvalidToken"
        })
      );

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers/${userId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: "{}"
    });

    expect(res.status).to.eq(500);
    let json = await res.json();

    expect(json.message).to.eq("InvalidToken");

    nocked.done();
  });

  it("It should unsubscribe a user", async () => {
    const topic = "TEST_TOPIC";
    const userId = "TEST_USER_ID";

    let nocked = unsubscribeUserNock(userId, topic);

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers/${userId}`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: "{}"
    });

    expect(res.status).to.eq(200);
    let json = await res.json();

    expect(json.subscribed).to.eq(false);

    nocked.done();
  });
});
