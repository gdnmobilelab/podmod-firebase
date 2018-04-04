import { PushkinRequestHandler } from "../util/request-handler";

interface TopicDetailsParams {
  topic_name: string;
}

export const getTopicDetails: PushkinRequestHandler<void, TopicDetailsParams> = async function(req, res, next) {
  try {
    let rows = await req.db.query(
      `

        SELECT COUNT (DISTINCT g.data->>'id') AS number, g.data->>'action' AS action
        FROM log_entries_grouped AS g
        WHERE g.data->>'id' IS NOT NULL
        AND g.data->>'action' IN ('subscribe', 'unsubscribe')
        AND g.data->>'topic' = $1
        GROUP BY g.data->>'action'

    `,
      [req.params.topic_name]
    );

    let subscribers = 0;
    let unsubscribers = 0;

    let row: {
      number: number;
      action: string;
    };
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
  } catch (err) {
    next(err);
  }
};
