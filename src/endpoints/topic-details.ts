import { PushkinRequestHandler } from "../util/request-handler";

interface TopicDetailsParams {
  topic_name: string;
}

export const getTopicDetails: PushkinRequestHandler<void, TopicDetailsParams> = async function(req, res, next) {
  try {
    let { rows } = await req.db.query(
      `
      SELECT 'current' as column, COUNT(*) as total from currently_subscribed WHERE topic_id = $1
      UNION
      SELECT action, COUNT (DISTINCT firebase_id)
      FROM subscription_log
      WHERE topic_id = $1
      GROUP BY action
    `,
      [req.params.topic_name]
    );

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
  } catch (err) {
    next(err);
  }
};
