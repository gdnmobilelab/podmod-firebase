import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer } from "../../src/index";
import { sendMessageNock } from "./send-message";
import { namespaceTopic } from "../../src/util/namespace";

export function subscribeUserNock(userId: string, topic: string) {
  return nock("https://iid.googleapis.com", {
    reqheaders: {
      "Content-Type": "application/json",
      authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
    }
  })
    .post(`/iid/v1/${userId}/rel/topics/${namespaceTopic(topic)}`)
    .reply(200, {});
}

export function unsubscribeUserNock(userId: string, topic: string) {
  return nock("https://iid.googleapis.com", {
    reqheaders: {
      "Content-Type": "application/json",
      authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
    }
  })
    .delete(`/iid/v1/${userId}/rel/topics/${namespaceTopic(topic)}`)
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

  it("Should subscribe a user", async () => {
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

    // expect(res.status).to.eq(200);
    let json = await res.json();
    expect(res.status).to.eq(200);
    expect(json.subscribed).to.eq(true);

    nocked.done();
  });

  it("Should fail when passing a non-existent token", async () => {
    const topic = "TEST_TOPIC";
    const userId = "TEST_USER_ID";

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        "Content-Type": "application/json",
        authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
      }
    })
      .post(`/iid/v1/${userId}/rel/topics/${namespaceTopic(topic)}`)
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

    expect(res.status).to.eq(400);
    let json = await res.json();
    expect(json.message).to.eq("FCM did not recognise client token");

    nocked.done();
  });

  it("Should unsubscribe a user", async () => {
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

  it("Should send a confirmation notification if included", async () => {
    const topic = "TEST_TOPIC";
    const userId = "TEST_USER_ID";

    let subscribeNock = subscribeUserNock(userId, topic);
    let messageNock = sendMessageNock({
      token: userId,
      notification: {
        title: "TEST_TITLE",
        body: "TEST_BODY"
      }
    });

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers/${userId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: JSON.stringify({
        confirmation: {
          notification: {
            title: "TEST_TITLE",
            body: "TEST_BODY"
          }
        }
      })
    });

    let json = await res.json();
    expect(res.status).to.eq(200);

    subscribeNock.done();
    // This part is essential, as it's our check that the message endpoint was actually hit.
    messageNock.done();
  });

  it("Should not send a confirmation notification if subscription fails", async () => {
    const topic = "TEST_TOPIC";
    const userId = "TEST_USER_ID";

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        "Content-Type": "application/json",
        authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
      }
    })
      .post(`/iid/v1/${userId}/rel/topics/${namespaceTopic(topic)}`)
      .reply(
        500,
        JSON.stringify({
          error: "AnyOldProblem"
        })
      );

    let messageNock = sendMessageNock({
      token: userId,
      notification: {
        title: "TEST_TITLE",
        body: "TEST_BODY"
      }
    });

    let res = await fetch(`http://localhost:3000/topics/${topic}/subscribers/${userId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      }
    });

    let json = await res.json();
    expect(res.status).to.eq(500);

    nocked.done();
    expect(messageNock.isDone()).to.eq(false);
  });
});
