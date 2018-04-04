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
// import { unnamespaceTopic } from "../util/namespace-topic";
const restify_errors_1 = require("restify-errors");
exports.getSubscribed = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            req.log.info({ id: req.params.registration_id, action: "get-subscriptions" }, "Received request to get subscribed topics.");
            let firebaseResponse = yield node_fetch_1.default(`https://iid.googleapis.com/iid/info/${req.params.registration_id}?details=true`, {
                headers: {
                    Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
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
            res.json(topics);
        }
        catch (err) {
            next(err);
        }
    });
};
//   .then(res => res.json())
//   .then((json: any) => {
//     if (json.error) {
//       req.log.error({ error: json.error, success: false }, "Request to get topics failed.");
//       throw new Error(json.error);
//     }
//     req.log.info({ success: true }, "Successfully retreived subscription topics");
//     let topics: string[] = [];
//     if (json.rel && json.rel.topics) {
//       // If there are no subscription this object just doesn't exist
//       topics = Object.keys(json.rel.topics);
//     }
//     let unnamespaced = topics.map(unnamespaceTopic);
//     let inThisEnvironment = unnamespaced.filter(n => n.environment == process.env.NODE_ENV);
//     res.json(inThisEnvironment.map(n => n.topicName));
//   });
//# sourceMappingURL=get-subscribed.js.map