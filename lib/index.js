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
// import { batchOperation } from "./endpoints/batch";
const log_1 = require("./log/log");
const db_1 = require("./util/db");
const key_check_1 = require("./security/key-check");
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("./util/env");
if (!env_1.default.NODE_ENV) {
    throw new Error("NODE_ENV environment variable is not set");
}
function createServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = db_1.createClient();
        const { log, dbStream } = log_1.createLogger(client);
        const server = restify.createServer({ log });
        // Annoying, some of our Firebase operations require the server key, whereas others
        // require a JWT token. We create an instance of the JWT token here, then add it to
        // the request object for use later.
        // dotenv doesn't parse out newlines, so we need to do a manual replace
        const privateKey = env_1.default.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
        console.log(privateKey);
        let jwt = new google_auth_library_1.JWT(env_1.default.FIREBASE_CLIENT_EMAIL, null, privateKey, [
            "https://www.googleapis.com/auth/firebase.messaging"
        ]);
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
            allowHeaders: ["API-Token"],
            exposeHeaders: ["API-Token-Expiry"]
        });
        // pre() calls are run before any route matching. In this case, it ensures that any
        // OPTIONS request gets the correct CORS response, irrespective of whether we have a matching
        // route.
        server.pre(cors.preflight);
        // use() on the other hand only runs on requests that have matching routes.
        server.use(restify.plugins.bodyParser({
            mapParams: false
        }), restify.plugins.requestLogger(), cors.actual, 
        // make our database client available on req.db. Most DB stuff goes through req.log() but
        // not all
        db_1.addClientToRequest(client, jwt));
        server.post("/registrations", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_firebase_id_1.getFirebaseId);
        server.get("/registrations/:registration_id/topics", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_subscribed_1.getSubscribed);
        server.post("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
        server.del("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
        server.post("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToTopic);
        server.post("/registrations/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToRegistration);
        server.get("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), topic_details_1.getTopicDetails);
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
        let webListenPromise = new Promise((fulfill, reject) => {
            server.listen(port, fulfill);
        });
        let dbConnectPromise = new Promise((fulfill, reject) => {
            client.connect(err => {
                if (err) {
                    reject(err);
                }
                else {
                    fulfill();
                }
            });
        });
        try {
            // If we can't successfully connect to the database or listen on the specified port, crash out.
            yield Promise.all([webListenPromise, dbConnectPromise]);
            log.warn({ action: "server-start", port, env: env_1.default.NODE_ENV }, "Server started.");
        }
        catch (err) {
            log.error({ error: err.message }, "Server failed to start");
            throw err;
        }
        // This could probably be more intuitive, but createServer() returns a function which, when run,
        // closes the server. We're only using this in tests so this is probably fine for now.
        return function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield new Promise(fulfill => dbStream.end(fulfill));
                yield Promise.all([new Promise(fulfill => client.end(fulfill)), new Promise(fulfill => server.close(fulfill))]);
                // log.warn({ action: "server-stop" }, "Stopped server");
            });
        };
    });
}
exports.createServer = createServer;
if (require.main === module) {
    env_1.check();
    createServer();
}
//# sourceMappingURL=index.js.map