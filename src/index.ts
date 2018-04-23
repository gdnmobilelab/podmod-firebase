import * as restify from "restify";
import * as restifyCORS from "restify-cors-middleware";
import { subscribeOrUnsubscribe } from "./endpoints/subscribe";
import { getFirebaseId } from "./endpoints/get-firebase-id";
import { getSubscribed } from "./endpoints/get-subscribed";
import { sendMessageToRegistration, sendMessageToTopic } from "./endpoints/send-message";
import { getTopicDetails } from "./endpoints/topic-details";
import { getVAPIDKey } from "./endpoints/vapid-key";
// import { batchOperation } from "./endpoints/batch";
import { createLogger } from "./log/log";
import { createClient as createDatabaseClient, addClientToRequest } from "./util/db";
import { checkForKey, ApiKeyType } from "./security/key-check";
import { JWT } from "google-auth-library";
import Environment, { check as checkEnvironmentVariables } from "./util/env";
import { promisify } from "util";

// When running tests we need to spin up and spin down the server on demand, so
// we wrap the actual creation in a function.

export async function createServer(): Promise<() => void> {
  const databaseClient = createDatabaseClient();

  // our custom bunyan instance
  const { log, dbStream } = createLogger(databaseClient);

  // create our restify server and have it use our logger, rather than
  // its own created one.
  const server = restify.createServer({ log });

  // Annoying, some of our Firebase operations require the server key, whereas others
  // require a JWT token. We create an instance of the JWT token here, then add it to
  // the request object for use later.

  // dotenv doesn't parse out newlines, so we need to do a manual replace
  const privateKey = Environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  let jwt = new JWT(
    Environment.FIREBASE_CLIENT_EMAIL,
    null,
    privateKey,
    ["https://www.googleapis.com/auth/firebase.messaging", "https://www.googleapis.com/auth/cloud-platform"],
    null
  );

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
    allowHeaders: ["Authorization"],
    exposeHeaders: []
  });

  // pre() calls are run before any route matching. In this case, it ensures that any
  // OPTIONS request gets the correct CORS response, irrespective of whether we have a matching
  // route.

  server.pre(cors.preflight);

  // use() on the other hand only runs on requests that have matching routes.

  server.use(
    restify.plugins.bodyParser({
      // by default the body parser adds values to req.params. I don't know why, it makes a lot
      // more sense to separate out req.params and req.body.
      mapParams: false,
      // If a POST request isn't sent with an application/json header, we reject it. Form encoding
      // etc can't reproduce the complex JSON data structures, so there's no point supporting it
      rejectUnknown: true
    }),
    restify.plugins.requestLogger(),
    cors.actual,
    // make our database client available on req.db. Most DB stuff goes through req.log() but
    // not all
    addClientToRequest(databaseClient, jwt)
  );

  server.post("/registrations", checkForKey(ApiKeyType.User), getFirebaseId);
  server.get("/registrations/:registration_id/topics", checkForKey(ApiKeyType.User), getSubscribed);
  server.post("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);
  server.del("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);

  server.post("/topics/:topic_name", checkForKey(ApiKeyType.Admin), sendMessageToTopic);
  server.post("/registrations/:registration_id", checkForKey(ApiKeyType.Admin), sendMessageToRegistration);
  server.get("/topics/:topic_name", checkForKey(ApiKeyType.Admin), getTopicDetails);
  server.get("/vapid-key", checkForKey(ApiKeyType.User), getVAPIDKey);

  server.get("/healthcheck", (req, res, next) => {
    // Used by Meta to ensure the service is working. Just needs to return a 200.
    res.end("OK");
  });

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

  let webListenPromise = promisify(server.listen).apply(server);
  let dbConnectPromise = promisify(databaseClient.connect).apply(databaseClient);

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
    await Promise.all([
      promisify(dbStream.end).apply(dbStream),
      promisify(databaseClient.end).apply(databaseClient),
      promisify(server.close).apply(server)
    ]);

    log.warn({ action: "server-stop" }, "Stopped server");
  };
}

if (require.main === module) {
  // If this is the entry point of the app (i.e. we're not running tests)
  // then go ahead and create the server automatically

  checkEnvironmentVariables();
  createServer();
}
