import * as restify from "restify";
import { query } from "../util/db";
import { namespaceTopic } from "../util/namespace-topic";

export const getSubscriberCount: restify.RequestHandler = function(req, res, next) {
  let topic = namespaceTopic(req.params["topic_name"]);

  // Because batch operations affect multiple IDs in one request, we grab all of the
  // requests that are subscribes or unsubscribes, then independently find all the IDs
  // associated with that request. In most instances it's a one to one match, but not
  // with batch operations.

  query(
    `

        SELECT COUNT (DISTINCT e.data->>'id') AS number, g.data->>'action' AS action
        FROM log_entries_grouped AS g
        INNER JOIN log_entries AS e
            ON g.req_id = e.req_id
            AND e.data->>'id' IS NOT NULL
        WHERE g.data->>'action' IN ('subscribe', 'unsubscribe')
        AND g.data->>'topicName' = $1
        GROUP BY g.data->>'action'


    `,
    [topic]
  )
    .then(rows => {
      let subscribers = 0;
      let unsubscribers = 0;

      let row: any;
      if ((row = rows.find(r => r.action === "subscribe"))) {
        subscribers = parseInt(row.number, 10);
      }

      if ((row = rows.find(r => r.action === "unsubscribe"))) {
        unsubscribers = parseInt(row.number, 10);
      }

      res.json({
        totalSubscribed: subscribers,
        totalUnsubscribed: unsubscribers,
        currentlySubscribed: subscribers - unsubscribers
      });
    })
    .catch(err => {
      next(err);
    });
};
