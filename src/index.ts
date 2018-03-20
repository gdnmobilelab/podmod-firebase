import * as restify from "restify";
import { subscribeOrUnsubscribe } from "./endpoints/subscribe";
import { getFirebaseId } from "./endpoints/get-firebase-id";
import { getSubscribed } from "./endpoints/get-subscribed";
import { sendMessageToTopic, sendMessageToRegistration } from "./endpoints/send-message";
import { getSubscriberCount } from "./endpoints/get-count";
import { batchOperation } from "./endpoints/batch";
import log from "./log/log";
import { RestifyError } from "./util/restify-error";
import { client } from "./util/db";
import { checkForKey, ApiKeyType } from "./security/key-check";

if (!process.env.NODE_ENV) {
  throw new Error("NODE_ENV environment variable is not set");
}

export async function createServer(): Promise<() => void> {
  const server = restify.createServer({
    log: log
  });

  server.use(
    restify.bodyParser({
      mapParams: false
    })
  );
  server.use(restify.requestLogger());

  server.use(
    restify.CORS({
      headers: ["authorization"]
    })
  );

  server.opts(/\.*/, function(req, res, next) {
    // for CORS
    let requestedHeaders = req.header("Access-Control-Request-Headers");
    res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE");
    res.send(200);
    next();
  });

  server.post("/registrations", checkForKey(ApiKeyType.User), getFirebaseId);
  server.get("/registrations/:registration_id/topics", checkForKey(ApiKeyType.User), getSubscribed);
  server.post(
    "/topics/:topic_name/subscribers/:registration_id",
    checkForKey(ApiKeyType.User),
    subscribeOrUnsubscribe
  );
  server.del(
    "/topics/:topic_name/subscribers/:registration_id",
    checkForKey(ApiKeyType.User),
    subscribeOrUnsubscribe
  );

  server.post("/topics/:topic_name", checkForKey(ApiKeyType.Admin), sendMessageToTopic);
  server.post("/registrations/:registration_id", sendMessageToRegistration);
  server.get("/topics/:topic_name/subscribers", checkForKey(ApiKeyType.Admin), getSubscriberCount);

  server.post(
    "/topics/:topic_name/batch/subscribe",
    checkForKey(ApiKeyType.Admin),
    batchOperation("subscribe")
  );
  server.post(
    "/topics/:topic_name/batch/unsubscribe",
    checkForKey(ApiKeyType.Admin),
    batchOperation("unsubscribe")
  );

  let webListenPromise = new Promise((fulfill, reject) => {
    server.listen(3000, fulfill);
  });

  let dbConnectPromise = new Promise((fulfill, reject) => {
    client.connect(err => {
      if (err) {
        reject(err);
      } else {
        fulfill();
      }
    });
  });

  try {
    await Promise.all([webListenPromise, dbConnectPromise]);
    log.warn({ action: "server-start", port: 3000, env: process.env.NODE_ENV }, "Server started.");
  } catch (err) {
    log.error({ error: err.message }, "Server failed to start");
    throw err;
  }

  return async function() {
    await Promise.all([client.end(), new Promise(fulfill => server.close(fulfill))]);
    log.warn({ action: "server-stop" }, "Stopped server");
  };
}

if (require.main === module) {
  createServer();
}
