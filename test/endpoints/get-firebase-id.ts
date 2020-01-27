import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer, Server } from "../../src/index";
import Environment from "../../src/util/env";

describe("Get Firebase ID", () => {
  let server: Server;

  before(async () => {
    server = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await server.stop();
  });

  it("Should get ID for a web subscription", async () => {
    let testSubscription = {
      endpoint: "http://www.example.com/push-endpoint",
      keys: {
        p256dh: "P256DH_KEY",
        auth: "TEST_AUTH"
      },
      expireTime: "SHOULD_NOT_BE_FORWARDED"
    };

    // Set up our HTTP mock to check that we're sending the correct information
    // over to FCM. The POST body should only have keys we've specified, rather
    // than the entire subscription object. So the 'expireTime' key above should
    // not appear.

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        "Content-Type": "application/json"
      }
    })
      .post(
        "/v1/web/iid",
        JSON.stringify({
          endpoint: "http://www.example.com/push-endpoint",
          keys: {
            p256dh: "P256DH_KEY",
            auth: "TEST_AUTH"
          }
        })
      )
      .reply(
        200,
        JSON.stringify({
          token: "TEST_TOKEN"
        })
      );

    // Now finally send our actual test request
    let res = await fetch("http://localhost:3000/registrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: JSON.stringify({ subscription: testSubscription })
    });

    let json = await res.json();
    expect(res.status).to.eq(200);

    expect(json.id).to.eq("TEST_TOKEN");
    nocked.done();
  });

  it("Should get ID for an iOS subscription", async () => {
    let testSubscription = {
      sandbox: false,
      device_id: "TEST_DEVICE_ID",
      bundle_name: "bundle.name.two",
      platform: "iOS"
    };

    // Set up our HTTP mock to check that we're sending the correct information
    // over to FCM. The POST body should only have keys we've specified, rather
    // than the entire subscription object. So the 'expireTime' key above should
    // not appear.

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        "Content-Type": "application/json",
        authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
      }
    })
      .post(
        "/iid/v1:batchImport",
        JSON.stringify({
          application: testSubscription.bundle_name,
          sandbox: testSubscription.sandbox,
          apns_tokens: [testSubscription.device_id]
        })
      )
      .reply(
        200,
        JSON.stringify({
          results: [
            {
              status: "OK",
              registration_token: "TEST_TOKEN"
            }
          ]
        })
      );

    // Now finally send our actual test request

    let res = await fetch("http://localhost:3000/registrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: JSON.stringify({ subscription: testSubscription })
    });

    expect(res.status).to.eq(200);

    let json = await res.json();
    expect(json.id).to.eq("TEST_TOKEN");
    nocked.done();
  });

  it("should fail to get iOS ID when bundle is not permitted", async () => {
    let testSubscription = {
      sandbox: false,
      device_id: "TEST_DEVICE_ID",
      bundle_name: "bundle.name.three",
      platform: "iOS"
    };

    let res = await fetch("http://localhost:3000/registrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      },
      body: JSON.stringify({ subscription: testSubscription })
    });

    expect(res.status).to.eq(400);
  });
});
