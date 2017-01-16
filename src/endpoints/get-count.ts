import * as restify from 'restify';
import {query} from '../util/db';
import {namespaceTopic} from '../util/namespace-topic';

export const getSubscriberCount:restify.RequestHandler = function(req, res, next) {

    let topic = namespaceTopic(req.params['topic_name']);

    query(`
        SELECT count(DISTINCT data->>'id') as number, data ->>'action' as action
        FROM log_entries_grouped
        WHERE (data->>'action' = 'unsubscribe' OR data->>'action' = 'subscribe')
        AND data->>'topicName' = $1
        GROUP BY data->>'action'  
    `, [topic])
    .then((rows) => {

        let subscribers = 0;
        let unsubscribers = 0;

        let row:any;
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
        })
    })
    .catch((err) => {
        next(err);
    })
}