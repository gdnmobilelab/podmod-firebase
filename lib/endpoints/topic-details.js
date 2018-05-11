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

        SELECT COUNT (DISTINCT g.data->>'id') AS number, g.data->>'action' AS action
        FROM log_entries_grouped AS g
        WHERE g.data->>'id' IS NOT NULL
        AND g.data->>'action' IN ('subscribe', 'unsubscribe')
        AND g.data->>'topic' = $1
        GROUP BY g.data->>'action'

    `, [req.params.topic_name]);
            let subscribers = 0;
            let unsubscribers = 0;
            let row;
            if ((row = rows.find(r => r.action === "subscribe"))) {
                subscribers = row.number;
            }
            if ((row = rows.find(r => r.action === "unsubscribe"))) {
                unsubscribers = row.number;
            }
            res.json({
                subscribers: {
                    subscribes: subscribers,
                    unsubscribes: unsubscribers,
                    currentlySubscribed: subscribers - unsubscribers
                }
            });
        }
        catch (err) {
            next(err);
        }
    });
};
//# sourceMappingURL=topic-details.js.map