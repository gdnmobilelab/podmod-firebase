import { createServer } from "../../src/index";
import fetch from "node-fetch";
import { expect } from "chai";
import { Client } from "pg";
import * as sinon from "sinon";

describe("Healthcheck", function() {
  let stop: () => void;
  let stub: sinon.SinonStub | undefined;

  before(async () => {
    stop = await createServer();
  });

  after(async () => {
    if (stub) {
      stub.restore();
    }
    await stop();
  });

  it("should return a 200 OK response", async function() {
    let response = await fetch("http://localhost:3000/healthcheck");
    expect(response.status).to.equal(200);
  });

  it("should return a 500 response when DB is not working", async function() {
    stub = sinon.stub(Client.prototype, "query").rejects(new Error("Cannot connect"));
    let response = await fetch("http://localhost:3000/healthcheck");
    expect(response.status).to.equal(500);
  });
});
