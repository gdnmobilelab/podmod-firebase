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
const restify_errors_1 = require("restify-errors");
const send_message_1 = require("./send-message");
const env_1 = require("../util/env");
const namespace_1 = require("../util/namespace");
const validate_1 = require("../validators/validate");
const jsonify_error_1 = require("../util/jsonify-error");
function sendRequest(id, topicName, method, log) {
    return __awaiter(this, void 0, void 0, function* () {
        let namespacedTopic = namespace_1.namespaceTopic(topicName);
        let url = `https://iid.googleapis.com/iid/v1/${id}/rel/topics/${namespacedTopic}`;
        log.info({ url, method }, "Sending request to Firebase");
        let res = yield node_fetch_1.default(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `key=${env_1.default.FIREBASE_AUTH_KEY}`
            }
        });
        if (res.status === 200) {
            return true;
        }
        let contentType = res.headers.get("content-type");
        if (contentType !== "application/json" && res.status === 403) {
            // The forbidden responses come in as HTML (for whatever reason)
            throw new restify_errors_1.BadRequestError("Received a 403 Forbidden error from Firebase");
        }
        let json = yield res.json();
        if (json.error === "InvalidToken") {
            throw new restify_errors_1.BadRequestError(`FCM did not recognise client token`);
        }
        throw new restify_errors_1.InternalServerError(json.error);
    });
}
exports.subscribeOrUnsubscribe = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        // let confirmationNotification: MessageSendBody = req.body["confirmation_notification"];
        try {
            let action = req.method == "POST" ? "subscribe" : "unsubscribe";
            req.log.info({ action, topic: req.params.topic_name, id: req.params.registration_id }, "Received request.");
            yield sendRequest(req.params.registration_id, req.params.topic_name, req.method, req.log);
            req.log.info({ success: true }, "Firebase request was successful");
            if (req.body && req.body.confirmation) {
                validate_1.validate(req.body.confirmation, "FCMMessage");
                req.log.info({ confirmation: req.body.confirmation }, "Sending confirmation notification");
                let mergedMessage = Object.assign({}, req.body.confirmation, {
                    token: req.params.registration_id
                });
                try {
                    yield send_message_1.sendMessage(mergedMessage, req);
                }
                catch (err) {
                    req.log.error({ error: err.message }, "Failed to send confirmation notification");
                    throw err;
                }
            }
            res.json({
                subscribed: action === "subscribe"
            });
        }
        catch (err) {
            req.log.warn({ error: jsonify_error_1.JSONifyError(err) }, "Failure when trying to set subscription action");
            next(err);
        }
    });
};
//# sourceMappingURL=subscribe.js.map