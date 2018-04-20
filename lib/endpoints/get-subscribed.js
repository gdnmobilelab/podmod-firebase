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
const env_1 = require("../util/env");
const namespace_1 = require("../util/namespace");
exports.getSubscribed = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            req.log.info({ id: req.params.registration_id, action: "get-subscriptions" }, "Received request to get subscribed topics.");
            let firebaseResponse = yield node_fetch_1.default(`https://iid.googleapis.com/iid/info/${req.params.registration_id}?details=true`, {
                headers: {
                    Authorization: `key=${env_1.default.FIREBASE_AUTH_KEY}`
                }
            });
            let json = yield firebaseResponse.json();
            if (json.error) {
                req.log.error({ error: json.error, success: false }, "Request to get topics failed.");
                throw new restify_errors_1.InternalServerError(json.error);
            }
            let topics = [];
            if (json.rel && json.rel.topics) {
                // If there are no subscription this object just doesn't exist
                topics = Object.keys(json.rel.topics);
            }
            topics = topics
                .map(topic => {
                try {
                    return namespace_1.extractNamespacedTopic(topic);
                }
                catch (err) {
                    // it's possible topics we don't know about exist, so we don't want to crash out
                    return null;
                }
            })
                .filter(extracted => extracted && extracted.env === env_1.default.NODE_ENV)
                .map(extracted => extracted.topic);
            res.json(topics);
        }
        catch (err) {
            next(err);
        }
    });
};
//# sourceMappingURL=get-subscribed.js.map