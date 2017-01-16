"use strict";
const db_1 = require('../util/db');
const namespace_topic_1 = require('../util/namespace-topic');
exports.getSubscriberCount = function (req, res, next) {
    let topic = namespace_topic_1.namespaceTopic(req.params['topic_name']);
    db_1.query(`
        SELECT count(DISTINCT data->>'id') as number, data ->>'action' as action
        FROM log_entries_grouped
        WHERE (data->>'action' = 'unsubscribe' OR data->>'action' = 'subscribe')
        AND data->>'topicName' = $1
        GROUP BY data->>'action'  
    `, [topic])
        .then((rows) => {
        let subscribers = 0;
        let unsubscribers = 0;
        let row;
        if (row = rows.find((r) => r.action === 'subscribe')) {
            subscribers = parseInt(row.number, 10);
        }
        if (row = rows.find((r) => r.action === 'unsubscribe')) {
            unsubscribers = parseInt(row.number, 10);
        }
        res.json({
            totalSubscribed: subscribers,
            totalUnsubscribed: unsubscribers,
            currentlySubscribed: subscribers - unsubscribers
        });
    })
        .catch((err) => {
        next(err);
    });
};
//# sourceMappingURL=get-count.js.map