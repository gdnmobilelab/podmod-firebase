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
              apns_token: testSubscription.device_id,
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

  it("Should stack requests for iOS subscriptions", async function() {
    const testSubscriptions = new Array(102).fill("").map((_, i) => {
      return {
        sandbox: false,
        device_id: "TEST_DEVICE_ID_" + i,
        bundle_name: "bundle.name.two",
        platform: "iOS"
      };
    });

    const testResponses = testSubscriptions.map((s, idx) => {
      return {
        status: "OK",
        apns_token: s.device_id,
        registration_token: "TEST_TOKEN_" + idx
      };
    });

    // Set up our HTTP mock to check that we're sending the correct information
    // over to FCM. The POST body should only have keys we've specified, rather
    // than the entire subscription object. So the 'expireTime' key above should
    // not appear.

    let arrayLengths = [];

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        "Content-Type": "application/json",
        authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
      }
    })
      .post("/iid/v1:batchImport")
      .times(3)
      .delay(10)
      .reply(200, (url, body, callback) => {
        arrayLengths.push(body.apns_tokens.length);

        let ids = body.apns_tokens.map(t => {
          return {
            status: "OK",
            apns_token: t,
            registration_token: "TEST_TOKEN_" + testSubscriptions.findIndex(s => s.device_id === t)
          };
        });
        callback(null, JSON.stringify({ results: ids }));
      });

    // Now finally send our actual test request

    const responses = testSubscriptions.map((sub, idx) => {
      return fetch("http://localhost:3000/registrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: process.env.USER_API_KEY
        },
        body: JSON.stringify({ subscription: sub })
      })
        .then(res => {
          expect(res.status).to.eq(200);
          return res.json();
        })
        .then(json => {
          expect(json.id).to.eq("TEST_TOKEN_" + idx);
        });
    });

    await Promise.all(responses);

    // expect(arrayLengths).to.deep.equal([1, 100, 1]);

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
