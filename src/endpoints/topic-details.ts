import { PushkinRequestHandler } from "../util/request-handler";
import { BadRequestError } from "restify-errors";
import { withDBClient } from "../util/db";

interface TopicDetailsParams {
  topic_name: string;
}

export const getTopicDetails: PushkinRequestHandler<void, TopicDetailsParams> = async function(req, res, next) {
  try {
    let { rows } = await withDBClient(c =>
      c.query(
        `
      SELECT 'current' as column, COUNT(*) as total from currently_subscribed WHERE topic_id = $1
      UNION
      SELECT action, COUNT (DISTINCT firebase_id)
      FROM subscription_log
      WHERE topic_id = $1
      GROUP BY action

    `,
        [req.params.topic_name]
      )
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
    let skip = 0;

    if ("page" in req.query && "skip" in req.query) {
      throw new BadRequestError("Cannot specify both page and skip parameters");
    }

    if ("page" in req.query) {
      let parsed = parseInt(req.query.page, 10);
      if (isNaN(parsed)) {
        throw new Error("Could not parse page number provided");
      }
      skip = (parsed - 1) * 1000;
    } else if ("skip" in req.query) {
      let parsed = parseInt(req.query.skip, 10);
      if (isNaN(parsed)) {
        throw new Error("Could not parse skip number provided");
      }
      skip = parsed;
    }

    let { rows } = await withDBClient(c =>
      c.query(
        `
      SELECT firebase_id from currently_subscribed WHERE topic_id = $1
      OFFSET $2 LIMIT $3
    `,
        [req.params.topic_name, skip, 1000]
      )
    );

    let ids = rows.map(r => r.firebase_id);

    res.json(ids);
  } catch (err) {
    next(err);
  }
};
