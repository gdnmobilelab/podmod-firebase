"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const restify = require("restify");
const restifyCORS = require("restify-cors-middleware");
const subscribe_1 = require("./endpoints/subscribe");
const get_firebase_id_1 = require("./endpoints/get-firebase-id");
const get_subscribed_1 = require("./endpoints/get-subscribed");
const send_message_1 = require("./endpoints/send-message");
const topic_details_1 = require("./endpoints/topic-details");
const vapid_key_1 = require("./endpoints/vapid-key");
// import { batchOperation } from "./endpoints/batch";
const log_1 = require("./log/log");
const db_1 = require("./util/db");
const key_check_1 = require("./security/key-check");
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("./util/env");
const util_1 = require("util");
const fs = require("fs");
let { version } = JSON.parse(fs.readFileSync(__dirname + "/../package.json", "UTF-8"));
// When running tests we need to spin up and spin down the server on demand, so
// we wrap the actual creation in a function.
function createServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const databaseClient = db_1.createClient();
        // our custom bunyan instance
        const { log, dbStream } = log_1.createLogger(databaseClient);
        // create our restify server and have it use our logger, rather than
        // its own created one.
        const server = restify.createServer({ log });
        // Annoying, some of our Firebase operations require the server key, whereas others
        // require a JWT token. We create an instance of the JWT token here, then add it to
        // the request object for use later.
        // dotenv doesn't parse out newlines, so we need to do a manual replace
        const privateKey = env_1.default.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
        let jwt = new google_auth_library_1.JWT(env_1.default.FIREBASE_CLIENT_EMAIL, null, privateKey, ["https://www.googleapis.com/auth/firebase.messaging", "https://www.googleapis.com/auth/cloud-platform"], null);
        yield jwt.authorize();
        // In almost all instances we're going to be running this on a different subdomain
        // than the pages actually calling the API. So we need to allow CORS requests, but
        // should also ensure we limit it to appropriate origins when deploying to staging
        // or production environments.
        if (env_1.default.NODE_ENV !== "dev" && !env_1.default.ALLOWED_ORIGINS) {
            log.warn("Starting server without restricted CORS origins");
        }
        const cors = restifyCORS({
            origins: env_1.default.ALLOWED_ORIGINS ? env_1.default.ALLOWED_ORIGINS.split(",") : ["*"],
            allowHeaders: ["Authorization"],
            exposeHeaders: []
        });
        // pre() calls are run before any route matching. In this case, it ensures that any
        // OPTIONS request gets the correct CORS response, irrespective of whether we have a matching
        // route.
        server.pre(cors.preflight);
        // use() on the other hand only runs on requests that have matching routes.
        server.use(restify.plugins.bodyParser({
            // by default the body parser adds values to req.params. I don't know why, it makes a lot
            // more sense to separate out req.params and req.body.
            mapParams: false,
            // If a POST request isn't sent with an application/json header, we reject it. Form encoding
            // etc can't reproduce the complex JSON data structures, so there's no point supporting it
            rejectUnknown: true
        }), restify.plugins.requestLogger(), cors.actual, 
        // make our database client available on req.db. Most DB stuff goes through req.log() but
        // not all
        db_1.addClientToRequest(databaseClient, jwt));
        server.post("/registrations", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_firebase_id_1.getFirebaseId);
        server.get("/registrations/:registration_id/topics", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_subscribed_1.getSubscribed);
        server.post("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
        server.del("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
        server.post("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToTopic);
        server.post("/registrations/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToRegistration);
        server.get("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), topic_details_1.getTopicDetails);
        server.get("/vapid-key", key_check_1.checkForKey(key_check_1.ApiKeyType.User), vapid_key_1.getVAPIDKey);
        server.get("/healthcheck", (req, res, next) => {
            // Used by Meta to ensure the service is working. Just needs to return a 200.
            res.end("OK");
        });
        // server.post("/topics/:topic_name/batch/subscribe", checkForKey(ApiKeyType.Admin), batchOperation("subscribe"));
        // server.post("/topics/:topic_name/batch/unsubscribe", checkForKey(ApiKeyType.Admin), batchOperation("unsubscribe"));
        let port = 3000;
        if (env_1.default.SERVER_PORT) {
            let parsedNumber = parseInt(env_1.default.SERVER_PORT, 10);
            if (isNaN(parsedNumber)) {
                throw new Error("Could not parse provided port as a number: " + env_1.default.SERVER_PORT);
            }
            port = parsedNumber;
        }
        // Both the pg and restify connection functions take callbacks, so we need to promisify them:
        let webListenPromise = util_1.promisify(server.listen).apply(server, [port]);
        let dbConnectPromise = util_1.promisify(databaseClient.connect).apply(databaseClient);
        try {
            // If we can't successfully connect to the database or listen on the specified port, crash out.
            yield Promise.all([webListenPromise, dbConnectPromise]);
            log.warn({ action: "server-start", port, env: env_1.default.NODE_ENV, version }, "Server started.");
        }
        catch (err) {
            log.error({ error: err.message }, "Server failed to start");
            throw err;
        }
        // This could probably be more intuitive, but createServer() returns a function which, when run,
        // closes the server. We're only using this in tests so this is probably fine for now.
        return function () {
            return __awaiter(this, void 0, void 0, function* () {
                // We finish the DB stream before the other promises because we need to make
                // sure it's finished before we close the DB connection.
                yield util_1.promisify(dbStream.end).apply(dbStream);
                yield Promise.all([util_1.promisify(databaseClient.end).apply(databaseClient), util_1.promisify(server.close).apply(server)]);
                // log.warn({ action: "server-stop" }, "Stopped server");
            });
        };
    });
}
exports.createServer = createServer;
if (require.main === module) {
    // If this is the entry point of the app (i.e. we're not running tests)
    // then go ahead and create the server automatically
    env_1.check();
    createServer();
}
//# sourceMappingURL=index.js.map