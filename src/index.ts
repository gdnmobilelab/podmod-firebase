import * as restify from "restify";
import * as restifyCORS from "restify-cors-middleware";
import { subscribeOrUnsubscribe } from "./endpoints/subscribe";
import { getFirebaseId } from "./endpoints/get-firebase-id";
import { getSubscribed } from "./endpoints/get-subscribed";
import { sendMessageToRegistration, sendMessageToTopic } from "./endpoints/send-message";
import { getTopicDetails } from "./endpoints/topic-details";
// import { batchOperation } from "./endpoints/batch";
import { createLogger } from "./log/log";
import { createClient as createDatabaseClient, addClientToRequest } from "./util/db";
import { checkForKey, ApiKeyType } from "./security/key-check";
import { JWT } from "google-auth-library";
import Environment, { check as checkEnvironmentVariables } from "./util/env";

if (!Environment.NODE_ENV) {
  throw new Error("NODE_ENV environment variable is not set");
}

export async function createServer(): Promise<() => void> {
  const client = createDatabaseClient();
  const { log, dbStream } = createLogger(client);

  const server = restify.createServer({ log });

  // Annoying, some of our Firebase operations require the server key, whereas others
  // require a JWT token. We create an instance of the JWT token here, then add it to
  // the request object for use later.

  // dotenv doesn't parse out newlines, so we need to do a manual replace
  const privateKey = Environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

  let jwt = new JWT(Environment.FIREBASE_CLIENT_EMAIL, null, privateKey, [
    "https://www.googleapis.com/auth/firebase.messaging"
  ]);

  await jwt.authorize();

  // In almost all instances we're going to be running this on a different subdomain
  // than the pages actually calling the API. So we need to allow CORS requests, but
  // should also ensure we limit it to appropriate origins when deploying to staging
  // or production environments.

  if (Environment.NODE_ENV !== "dev" && !Environment.ALLOWED_ORIGINS) {
    log.warn("Starting server without restricted CORS origins");
  }

  const cors = restifyCORS({
    origins: Environment.ALLOWED_ORIGINS ? Environment.ALLOWED_ORIGINS.split(",") : ["*"],
    allowHeaders: ["API-Token"],
    exposeHeaders: ["API-Token-Expiry"]
  });

  // pre() calls are run before any route matching. In this case, it ensures that any
  // OPTIONS request gets the correct CORS response, irrespective of whether we have a matching
  // route.

  server.pre(cors.preflight);

  // use() on the other hand only runs on requests that have matching routes.

  server.use(
    restify.plugins.bodyParser({
      mapParams: false
    }),
    restify.plugins.requestLogger(),
    cors.actual,
    // make our database client available on req.db. Most DB stuff goes through req.log() but
    // not all
    addClientToRequest(client, jwt)
  );

  server.post("/registrations", checkForKey(ApiKeyType.User), getFirebaseId);
  server.get("/registrations/:registration_id/topics", checkForKey(ApiKeyType.User), getSubscribed);
  server.post("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);
  server.del("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);

  server.post("/topics/:topic_name", checkForKey(ApiKeyType.Admin), sendMessageToTopic);
  server.post("/registrations/:registration_id", checkForKey(ApiKeyType.Admin), sendMessageToRegistration);
  server.get("/topics/:topic_name", checkForKey(ApiKeyType.Admin), getTopicDetails);

  // server.post("/topics/:topic_name/batch/subscribe", checkForKey(ApiKeyType.Admin), batchOperation("subscribe"));
  // server.post("/topics/:topic_name/batch/unsubscribe", checkForKey(ApiKeyType.Admin), batchOperation("unsubscribe"));

  let port = 3000;

  if (Environment.SERVER_PORT) {
    let parsedNumber = parseInt(Environment.SERVER_PORT, 10);
    if (isNaN(parsedNumber)) {
      throw new Error("Could not parse provided port as a number: " + Environment.SERVER_PORT);
    }
    port = parsedNumber;
  }

  // Both the pg and restify connection functions take callbacks, so we need to promisify them:

  let webListenPromise = new Promise((fulfill, reject) => {
    server.listen(port, fulfill);
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
    // If we can't successfully connect to the database or listen on the specified port, crash out.
    await Promise.all([webListenPromise, dbConnectPromise]);
    log.warn({ action: "server-start", port, env: Environment.NODE_ENV }, "Server started.");
  } catch (err) {
    log.error({ error: err.message }, "Server failed to start");
    throw err;
  }

  // This could probably be more intuitive, but createServer() returns a function which, when run,
  // closes the server. We're only using this in tests so this is probably fine for now.

  return async function() {
    await new Promise(fulfill => dbStream.end(fulfill));
    await Promise.all([new Promise(fulfill => client.end(fulfill)), new Promise(fulfill => server.close(fulfill))]);
    // log.warn({ action: "server-stop" }, "Stopped server");
  };
}

if (require.main === module) {
  checkEnvironmentVariables();
  createServer();
}
