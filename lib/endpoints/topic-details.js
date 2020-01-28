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
const restify_errors_1 = require("restify-errors");
const db_1 = require("../util/db");
exports.getTopicDetails = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let { rows } = yield db_1.withDBClient(c => c.query(`
      SELECT 'current' as column, COUNT(*) as total from currently_subscribed WHERE topic_id = $1
      UNION
      SELECT action, COUNT (DISTINCT firebase_id)
      FROM subscription_log
      WHERE topic_id = $1
      GROUP BY action

    `, [req.params.topic_name]));
            let current = rows.find(r => r.column === "current");
            let subscribed = rows.find(r => r.column === "subscribe");
            let unsubscribe = rows.find(r => r.column === "unsubscribe");
            res.json({
                subscribers: {
                    subscribes: subscribed ? subscribed.total : 0,
                    unsubscribes: unsubscribe ? unsubscribe.total : 0,
                    currentlySubscribed: current.total
                }
            });
        }
        catch (err) {
            next(err);
        }
    });
};
exports.getTopicSubscribers = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let skip = 0;
            if ("page" in req.query && "skip" in req.query) {
                throw new restify_errors_1.BadRequestError("Cannot specify both page and skip parameters");
            }
            if ("page" in req.query) {
                let parsed = parseInt(req.query.page, 10);
                if (isNaN(parsed)) {
                    throw new Error("Could not parse page number provided");
                }
                skip = (parsed - 1) * 1000;
            }
            else if ("skip" in req.query) {
                let parsed = parseInt(req.query.skip, 10);
                if (isNaN(parsed)) {
                    throw new Error("Could not parse skip number provided");
                }
                skip = parsed;
            }
            let { rows } = yield db_1.withDBClient(c => c.query(`
      SELECT firebase_id from currently_subscribed WHERE topic_id = $1
      OFFSET $2 LIMIT $3
    `, [req.params.topic_name, skip, 1000]));
            let ids = rows.map(r => r.firebase_id);
            res.json(ids);
        }
        catch (err) {
            next(err);
        }
    });
};
//# sourceMappingURL=topic-details.js.map