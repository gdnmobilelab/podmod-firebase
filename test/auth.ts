import { createServer } from "../src/index";
import fetch from "node-fetch";
import { expect } from "chai";
import * as nock from "nock";

describe("Authorisation", () => {
  let stop: () => void;

  before(async () => {
    stop = await createServer();
  });

  after(async () => {
    nock.cleanAll();
    await stop();
  });

  it("Should deny at the user level", async () => {
    let res = await fetch("http://localhost:3000/registrations/TEST_ID/topics", {
      headers: {
        authorization: "NOT_OUR_TEST_KEY"
      }
    });
    expect(res.status).to.eq(403);
  });

  it("Should allow at the user level", async () => {
    let nocked = nock("https://iid.googleapis.com")
      .get("/iid/info/TEST_ID?details=true")
      .reply(200, JSON.stringify([]));

    let res = await fetch("http://localhost:3000/registrations/TEST_ID/topics", {
      headers: {
        authorization: process.env.USER_API_KEY
      }
    });
    expect(res.status).to.eq(200);
    nocked.done();
  });

  it("Should deny at the admin level", async () => {
    let res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers", {
      headers: {
        authorization: "NOT_OUR_TEST_KEY"
      }
    });
    expect(res.status).to.eq(403);
  });

  it("Should allow at the admin level", async () => {
    process.env.ADMIN_API_KEY = "TEST_ADMIN_KEY";
    let res = await fetch("http://localhost:3000/topics/TEST_TOPIC/subscribers", {
      headers: {
        authorization: process.env.ADMIN_API_KEY
      }
    });
    expect(res.status).to.eq(200);
  });
});
