import * as nock from "nock";
import fetch from "node-fetch";
import { expect } from "chai";
import { createServer } from "../../src/index";
import * as sinon from "sinon";
import * as GoogleAuth from "google-auth-library";

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

describe("Toggle subscription state", () => {
  let stop: () => void;
  let stub: sinon.SinonStub;

  before(async () => {
    stub = sinon.stub(GoogleAuth, "JWT").returns({
      getAccessToken() {
        return Promise.resolve({ token: "TEST_TOKEN" });
      },
      authorize() {
        return Promise.resolve(true);
      }
    });

    stop = await createServer();
  });

  after(async () => {
    stub.restore();
    nock.cleanAll();
    await stop();
  });

  it.only("tests", async () => {});
});
