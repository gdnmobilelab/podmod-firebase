import * as restify from "restify";
import * as restifyCORS from "restify-cors-middleware";
import { applyCachingHeaders } from "./util/http-cache-headers";
// import { batchOperation } from "./endpoints/batch";
import { createLogger } from "./log/log";
import { setup as setupDB, withDBClient, shutdown as shutdownDB } from "./util/db";
import Environment, { check as checkEnvironmentVariables } from "./util/env";
import { setup as setupJWT } from "./util/jwt";
import { promisify } from "util";
import * as fs from "fs";
import { setRoutes } from "./routes";

let { version } = JSON.parse(fs.readFileSync(__dirname + "/../package.json", "UTF-8"));

export interface Server {
  stop: () => void;
}

// When running tests we need to spin up and spin down the server on demand, so
// we wrap the actual creation in a function.

export async function createServer(): Promise<Server> {
  await setupDB();

  // our custom bunyan instance. TODO: remove the DB logging part, we don't need it any more
  const { log, dbStream } = await withDBClient(c => createLogger(c));

  // create our restify server and have it use our logger, rather than
  // its own created one.
  const server = restify.createServer({ log });

  await setupJWT();

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
    exposeHeaders: ["Cache-Control"],
    preflightMaxAge: 5
  });

  // pre() calls are run before any route matching. In this case, it ensures that any
  // OPTIONS request gets the correct CORS response, irrespective of whether we have a matching
  // route.

  server.pre(cors.preflight);

  // use() on the other hand only runs on requests that have matching routes.

  server.use(
    restify.plugins.queryParser(),
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
    applyCachingHeaders
  );

  setRoutes(server);

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

  let webListenPromise = promisify(server.listen).apply(server, [port]);

  try {
    // If we can't successfully connect to the database or listen on the specified port, crash out.
    await webListenPromise;
    log.warn({ action: "server-start", port, env: Environment.NODE_ENV, version }, "Server started.");
  } catch (err) {
    log.error({ error: err.message, stack: err.stack }, "Server failed to start");
    throw err;
  }

  // This could probably be more intuitive, but createServer() returns a function which, when run,
  // closes the server. We're only using this in tests so this is probably fine for now.

  let stop = async function() {
    // We finish the DB stream before the other promises because we need to make
    // sure it's finished before we close the DB connection.
    await promisify(dbStream.end).apply(dbStream);
    console.log("stream ended");
    await shutdownDB();
    console.log("db shut down");
    await promisify(server.close).apply(server);
    console.log("server closed");
    // await Promise.all([shutdownDB(), promisify(server.close).apply(server)]);

    // log.warn({ action: "server-stop" }, "Stopped server");
  };

  return { stop };
}

if (require.main === module) {
  // If this is the entry point of the app (i.e. we're not running tests)
  // then go ahead and create the server automatically
  try {
    checkEnvironmentVariables();
    createServer();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}
