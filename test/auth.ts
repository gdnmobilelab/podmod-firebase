import fetch from "node-fetch";
import { expect } from "chai";
import * as restify from "restify";
import { checkForKey, ApiKeyType } from "../src/security/key-check";
import { createLogger } from "../src/log/log";
import Environment from "../src/util/env";
import * as bunyan from "bunyan";

describe("Authorisation", () => {
  // let stop: () => void;

  let server: restify.Server | undefined;
  let log = bunyan.createLogger({ name: "dummy", level: 100 });

  beforeEach(async () => {
    server = restify.createServer({ log });
  });

  afterEach(done => {
    server.close(done);
    server = undefined;
  });

  it("Should deny at the user level", async () => {
    server.get("/deny-user", checkForKey(ApiKeyType.User), (req, res) => {
      res.end("yes");
    });

    server.listen(3000);

    let res = await fetch("http://localhost:3000/deny-user", {
      headers: {
        authorization: "NOT_OUR_TEST_KEY"
      }
    });
    expect(res.status).to.eq(403);
  });

  it("Should allow at the user level", async () => {
    server.get("/allow-user", checkForKey(ApiKeyType.User), (req, res) => {
      res.end("yes");
    });

    server.listen(3000);

    let res = await fetch("http://localhost:3000/allow-user", {
      headers: {
        authorization: Environment.USER_API_KEY
      }
    });

    expect(res.status).to.eq(200);
  });

  it("Should deny at the admin level", async () => {
    server.get("/deny-admin", checkForKey(ApiKeyType.Admin), (req, res) => {
      res.end("yes");
    });

    server.listen(3000);

    let res = await fetch("http://localhost:3000/deny-admin", {
      headers: {
        authorization: "NOT_OUR_TEST_KEY"
      }
    });
    expect(res.status).to.eq(403);
  });

  it("Should allow at the admin level", async () => {
    server.get("/allow-admin", checkForKey(ApiKeyType.Admin), (req, res) => {
      res.end("yes");
    });

    server.listen(3000);

    let res = await fetch("http://localhost:3000/allow-admin", {
      headers: {
        authorization: Environment.ADMIN_API_KEY
      }
    });

    expect(res.status).to.eq(200);
  });
});
