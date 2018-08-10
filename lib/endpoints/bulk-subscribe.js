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
const node_fetch_1 = require("node-fetch");
const env_1 = require("../util/env");
const restify_errors_1 = require("restify-errors");
function sendRequest(operation, topicName, ids, log) {
    return __awaiter(this, void 0, void 0, function* () {
        log.info({ operation, topicName, numberOfIds: ids.length }, "Sending batch operation to Firebase...");
        let res = yield node_fetch_1.default("https://iid.googleapis.com/iid/v1:" + operation, {
            method: "POST",
            headers: {
                Authorization: "key=" + env_1.default.FIREBASE_AUTH_KEY
            },
            body: JSON.stringify({
                to: "/topics/" + topicName,
                registration_tokens: ids
            })
        });
        let json = yield res.json();
        let errorCount = 0;
        json.results.forEach((result, idx) => {
            if (!result.error) {
                return;
            }
            let id = ids[idx];
            log.warn({ id, error: result.error }, "Received error in response to batch operation");
            errorCount++;
        });
        if (errorCount === 0) {
            log.info("Received successful batch operation response");
        }
        else {
            log.warn({ failures: errorCount }, "Received failures in response to batch operation");
        }
        return json.results;
    });
}
exports.bulkSubscribeOrUnsubscribe = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!req.params.topic_name) {
                throw new restify_errors_1.BadRequestError("Topic was not provided");
            }
            if (!req.body.ids || req.body.ids.some(v => typeof v !== "string")) {
                throw new restify_errors_1.BadRequestError("Must send list of IDs and all of them must be strings");
            }
            if (req.body.ids.length > 1000) {
                throw new restify_errors_1.BadRequestError("Can only send up to 1000 IDs at once.");
            }
            let operation = req.method === "POST" ? "batchAdd" : "batchRemove";
            let results = yield sendRequest(operation, req.params.topic_name, req.body.ids, req.log);
            res.json(results);
        }
        catch (err) {
            req.log.warn({ err: err.message }, "Failure when trying to send batch operation");
            next(err);
        }
    });
};
//# sourceMappingURL=bulk-subscribe.js.map