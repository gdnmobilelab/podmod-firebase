import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer, Server } from "../../src/index";
import { namespaceTopic } from "../../src/util/namespace";
import Environment from "../../src/util/env";

describe("Get subscribed topics", () => {
  let server: Server;

  before(async () => {
    server = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await server.stop();
  });

  it("Should get subscribed topics for a user", async () => {
    let topicsToReturn = {};
    topicsToReturn[namespaceTopic("TEST_TOPIC")] = 1;
    // insert one from a different env to make sure we filter
    topicsToReturn[`=${Environment.TOPIC_PREFIX}=NOTTEST=TEST_TOPIC`] = 1;

    let nocked = nock("https://iid.googleapis.com", {
      reqheaders: {
        authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
      }
    })
      .get("/iid/info/TEST_USER")
      .query({ details: "true" })
      .reply(
        200,
        JSON.stringify({
          rel: {
            topics: topicsToReturn
          }
        })
      );

    // Now finally send our actual test request
    let res = await fetch("http://localhost:3000/registrations/TEST_USER/topics", {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: process.env.USER_API_KEY
      }
    });

    let json = await res.json();

    expect(res.status).to.eq(200);
    expect(json.length).to.eq(1);
    expect(json[0]).to.eq("TEST_TOPIC");
    nocked.done();
  });
});
