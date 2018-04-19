import fetch from "node-fetch";
import { PushkinRequestHandler } from "../util/request-handler";
import { InternalServerError } from "restify-errors";
import Environment from "../util/env";
import { namespaceTopic, extractNamespacedTopic } from "../util/namespace";

interface GetSubscribedParams {
  registration_id: string;
}

export const getSubscribed: PushkinRequestHandler<void, GetSubscribedParams> = async function(req, res, next) {
  try {
    req.log.info(
      { id: req.params.registration_id, action: "get-subscriptions" },
      "Received request to get subscribed topics."
    );

    let firebaseResponse = await fetch(
      `https://iid.googleapis.com/iid/info/${req.params.registration_id}?details=true`,
      {
        headers: {
          Authorization: `key=${Environment.FIREBASE_AUTH_KEY}`
        }
      }
    );

    let json = await firebaseResponse.json();

    if (json.error) {
      req.log.error({ error: json.error, success: false }, "Request to get topics failed.");
      throw new InternalServerError(json.error);
    }

    let topics: string[] = [];

    if (json.rel && json.rel.topics) {
      // If there are no subscription this object just doesn't exist
      topics = Object.keys(json.rel.topics);
    }

    topics = topics
      .map(topic => {
        try {
          return extractNamespacedTopic(topic);
        } catch (err) {
          // it's possible topics we don't know about exist, so we don't want to crash out
          return null;
        }
      })
      .filter(extracted => extracted && extracted.env === Environment.NODE_ENV)
      .map(extracted => extracted.topic);

    res.json(topics);
  } catch (err) {
    next(err);
  }
};
