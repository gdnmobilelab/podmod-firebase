import fetch from "node-fetch";
import { expect } from "chai";
import * as restify from "restify";
import { checkForKey, ApiKeyType } from "../src/security/key-check";
import { createLogger } from "../src/log/log";
import Environment from "../src/util/env";
import * as bunyan from "bunyan";
import { applyCachingHeaders } from "../src/util/http-cache-headers";

describe("HTTP server", () => {
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

  it("Should always send a no-cache header", async () => {
    server.use(applyCachingHeaders);
    server.get("/example", (req, res) => {
      res.end("yes");
    });

    server.listen(3000);

    let res = await fetch("http://localhost:3000/example");
    expect(res.headers.get("cache-control")).to.eq("no-cache");
  });

  it("Should not send no-cache on OPTIONS requests", async () => {
    server.use(applyCachingHeaders);
    server.opts("/example", (req, res) => {
      res.end("yes");
    });

    server.listen(3000);

    let res = await fetch("http://localhost:3000/example", {
      method: "OPTIONS"
    });
    expect(res.headers.get("cache-control")).to.not.exist;
  });
});
