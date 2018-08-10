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
exports.getTopicDetails = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let { rows } = yield req.db.query(`
      SELECT 'current' as column, COUNT(*) as total from currently_subscribed WHERE topic_id = $1
      UNION
      SELECT action, COUNT (DISTINCT firebase_id)
      FROM subscription_log
      WHERE topic_id = $1
      GROUP BY action

    `, [req.params.topic_name]);
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
            let pageNumber = 1;
            if ("page" in req.query) {
                let parsed = parseInt(req.query.page, 10);
                if (isNaN(parsed)) {
                    throw new Error("Could not parse page number provided");
                }
                pageNumber = parsed;
            }
            let zeroIndexedPageNumber = pageNumber - 1;
            let { rows } = yield req.db.query(`
      SELECT firebase_id from currently_subscribed WHERE topic_id = $1
      OFFSET $2 LIMIT $3
    `, [req.params.topic_name, zeroIndexedPageNumber * 1000, 1000]);
            let ids = rows.map(r => r.firebase_id);
            res.json(ids);
        }
        catch (err) {
            next(err);
        }
    });
};
//# sourceMappingURL=topic-details.js.map