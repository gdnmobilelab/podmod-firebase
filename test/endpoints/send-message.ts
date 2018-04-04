import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer } from "../../src/index";

import Environment from "../../src/util/env";

// let res = await fetch(`https://fcm.googleapis.com/v1/projects${Environment.FCM_PROJECT}/messages:send`, {
//   headers: {
//     "Content-Type": "application/json",
//     Authorization: "Bearer " + token
//   },
//   body: JSON.stringify(sendBody)
// });

export function sendMessageNock(target) {
  return nock("https://fcm.googleapis.com", {
    reqheaders: {
      "Content-Type": "application/json",
      authorization: "Bearer TEST_TOKEN"
    }
  })
    .post(`/v1/projects/${Environment.FCM_PROJECT}/messages:send`, {
      message: target,
      validate_only: false
    })
    .reply(200, {
      name: "/test_message"
    });
}

describe("Send message", () => {
  let stop: () => void;

  before(async () => {
    stop = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await stop();
  });

  it("Should error when bad request body sent", async () => {
    let res = await fetch(`http://localhost:3000/registrations/TEST_PUSH_TOKEN`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: Environment.ADMIN_API_KEY
      },
      body: JSON.stringify({
        message: {
          blah: "incomplete"
        }
      })
    });

    expect(res.status).to.eq(400);
    let json = await res.json();
    expect(json.message).to.eq("Request validation failed");
  });

  it("Should successfully send token message", async () => {
    let nocked = sendMessageNock({
      token: "TEST_PUSH_TOKEN",
      notification: {
        title: "Test title",
        body: "test body"
      }
    });

    let res = await fetch(`http://localhost:3000/registrations/TEST_PUSH_TOKEN`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: Environment.ADMIN_API_KEY
      },
      body: JSON.stringify({
        message: {
          notification: {
            title: "Test title",
            body: "test body"
          }
        }
      })
    });
    let json = await res.json();
    expect(res.status).to.eq(200);

    expect(json.success).to.eq(true);
    expect(json.name).to.eq("/test_message");

    nocked.done();
  });

  it("Should successfully send topic message", async () => {
    let nocked = sendMessageNock({
      topic: "TEST_TOPIC",
      notification: {
        title: "Test title",
        body: "test body"
      }
    });

    let res = await fetch(`http://localhost:3000/topics/TEST_TOPIC`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: Environment.ADMIN_API_KEY
      },
      body: JSON.stringify({
        message: {
          notification: {
            title: "Test title",
            body: "test body"
          }
        }
      })
    });

    expect(res.status).to.eq(200);
    let json = await res.json();

    expect(json.success).to.eq(true);
    expect(json.name).to.eq("/test_message");

    nocked.done();
  });
});
