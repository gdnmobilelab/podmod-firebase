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
const validate_1 = require("../validators/validate");
const env_1 = require("../util/env");
const errors_1 = require("../util/errors");
const namespace_1 = require("../util/namespace");
const restify_errors_1 = require("restify-errors");
function sendMessage(message, req) {
    return __awaiter(this, void 0, void 0, function* () {
        req.log.info(message, "Trying to send a message");
        let sendBody = {
            message,
            validate_only: false
        };
        let { token } = yield req.jwt.getAccessToken();
        let res = yield node_fetch_1.default(`https://fcm.googleapis.com/v1/projects/${env_1.default.FCM_PROJECT}/messages:send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
            },
            body: JSON.stringify(sendBody)
        });
        let jsonResponse = yield res.json();
        if (jsonResponse.error) {
            req.log.error(jsonResponse.error, "Encountered error when trying to send message");
            throw new restify_errors_1.InternalServerError(jsonResponse.error.message);
        }
        req.log.info({ message_name: jsonResponse.name }, "Message successfully sent");
        return jsonResponse.name;
    });
}
exports.sendMessage = sendMessage;
exports.sendMessageToRegistration = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            req.log.info({
                action: "send-message",
                target_type: "registration",
                topic: req.params.registration_id
            }, "Received request to send message");
            // Take the FCMMessage the user sent, and merge it with the registration ID to form
            // a token message send request.
            let mergedMessage = Object.assign({}, req.body.message, { token: req.params.registration_id });
            validate_1.validate(mergedMessage, "FCMTokenMessage");
            let name = yield sendMessage(mergedMessage, req);
            req.log.info({ name }, "Successfully sent message");
            res.json({
                success: true,
                name
            });
        }
        catch (err) {
            let target = "error";
            if (err instanceof restify_errors_1.BadRequestError || err instanceof errors_1.ValidationFailedError) {
                target = "warn";
            }
            req.log[target]({ error: err.message }, "Failed to send message");
            next(err);
        }
    });
};
exports.sendMessageToTopic = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let namespacedTopic = namespace_1.namespaceTopic(req.params.topic_name);
            req.log.info({
                action: "send-message",
                target_type: "topic",
                topic: req.params.topic_name,
                namespaced: namespacedTopic
            }, "Received request to send message");
            let mergedMessage = Object.assign({}, req.body.message, { topic: namespacedTopic });
            validate_1.validate(mergedMessage, "FCMTopicMessage");
            let name = yield sendMessage(mergedMessage, req);
            req.log.info({ name }, "Successfully sent message");
            res.json({
                success: true,
                name
            });
        }
        catch (err) {
            let target = "error";
            if (err instanceof restify_errors_1.BadRequestError || err instanceof errors_1.ValidationFailedError) {
                target = "warn";
            }
            req.log[target]({ error: err.message }, "Failed to send message");
            next(err);
        }
    });
};
exports.sendMessageToCondition = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!req.body.condition) {
                throw new restify_errors_1.BadRequestError("Must specify a 'condition' to send a message");
            }
            let namespacedCondition = namespace_1.namespaceCondition(req.body.condition);
            req.log.info({
                action: "send-message",
                target_type: "condition",
                condition: req.body.condition,
                namespaced: namespacedCondition
            }, "Received request to send message");
            let mergedMessage = Object.assign({}, req.body.message, { condition: namespacedCondition });
            validate_1.validate(mergedMessage, "FCMConditionMessage");
            let name = yield sendMessage(mergedMessage, req);
            req.log.info({ name }, "Successfully sent message");
            res.json({
                success: true,
                name
            });
        }
        catch (err) {
            let target = "error";
            if (err instanceof restify_errors_1.BadRequestError || err instanceof errors_1.ValidationFailedError) {
                target = "warn";
            }
            req.log[target]({ error: err.message }, "Failed to send message");
            next(err);
        }
    });
};
//# sourceMappingURL=send-message.js.map