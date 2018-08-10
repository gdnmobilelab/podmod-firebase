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

interface TopicSubscriberParams {
  topic_name: string;
}

export const getTopicSubscribers: PushkinRequestHandler<void, TopicSubscriberParams> = async function(req, res, next) {
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

    let { rows } = await req.db.query(
      `
      SELECT firebase_id from currently_subscribed WHERE topic_id = $1
      OFFSET $2 LIMIT $3
    `,
      [req.params.topic_name, zeroIndexedPageNumber * 1000, 1000]
    );

    let ids = rows.map(r => r.firebase_id);

    res.json(ids);
  } catch (err) {
    next(err);
  }
};
