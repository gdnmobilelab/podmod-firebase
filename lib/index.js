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
const subscribe_1 = require("./endpoints/subscribe");
const get_firebase_id_1 = require("./endpoints/get-firebase-id");
const get_subscribed_1 = require("./endpoints/get-subscribed");
const send_message_1 = require("./endpoints/send-message");
const get_count_1 = require("./endpoints/get-count");
const batch_1 = require("./endpoints/batch");
const log_1 = require("./log/log");
const db_1 = require("./util/db");
const key_check_1 = require("./security/key-check");
if (!process.env.NODE_ENV) {
    throw new Error("NODE_ENV environment variable is not set");
}
function createServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const server = restify.createServer({
            log: log_1.default
        });
        server.use(restify.bodyParser({
            mapParams: false
        }));
        server.use(restify.requestLogger());
        server.use(restify.CORS({
            headers: ["authorization"]
        }));
        server.opts(/\.*/, function (req, res, next) {
            // for CORS
            let requestedHeaders = req.header("Access-Control-Request-Headers");
            res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE");
            res.send(200);
            next();
        });
        server.post("/registrations", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_firebase_id_1.getFirebaseId);
        server.get("/registrations/:registration_id/topics", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_subscribed_1.getSubscribed);
        server.post("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
        server.del("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
        server.post("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToTopic);
        server.post("/registrations/:registration_id", send_message_1.sendMessageToRegistration);
        server.get("/topics/:topic_name/subscribers", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), get_count_1.getSubscriberCount);
        server.post("/topics/:topic_name/batch/subscribe", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), batch_1.batchOperation("subscribe"));
        server.post("/topics/:topic_name/batch/unsubscribe", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), batch_1.batchOperation("unsubscribe"));
        let webListenPromise = new Promise((fulfill, reject) => {
            server.listen(3000, fulfill);
        });
        let dbConnectPromise = new Promise((fulfill, reject) => {
            db_1.client.connect(fulfill);
        });
        try {
            yield Promise.all([webListenPromise, dbConnectPromise]);
            log_1.default.warn({ action: "server-start", port: 3000, env: process.env.NODE_ENV }, "Server started.");
        }
        catch (err) {
            log_1.default.error({ error: err.message }, "Server failed to start");
        }
        return function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield Promise.all([db_1.client.end(), new Promise(fulfill => server.close(fulfill))]);
                log_1.default.warn({ action: "server-stop" }, "Stopped server");
            });
        };
    });
}
exports.createServer = createServer;
if (require.main === module) {
    createServer();
}
//# sourceMappingURL=index.js.map