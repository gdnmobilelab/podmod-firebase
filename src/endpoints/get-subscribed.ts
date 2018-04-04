import fetch from "node-fetch";
import { PushkinRequestHandler } from "../util/request-handler";
// import { unnamespaceTopic } from "../util/namespace-topic";
import { InternalServerError } from "restify-errors";

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
          Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
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

    res.json(topics);
  } catch (err) {
    next(err);
  }
};

//   .then(res => res.json())
//   .then((json: any) => {
//     if (json.error) {
//       req.log.error({ error: json.error, success: false }, "Request to get topics failed.");
//       throw new Error(json.error);
//     }

//     req.log.info({ success: true }, "Successfully retreived subscription topics");

//     let topics: string[] = [];

//     if (json.rel && json.rel.topics) {
//       // If there are no subscription this object just doesn't exist
//       topics = Object.keys(json.rel.topics);
//     }

//     let unnamespaced = topics.map(unnamespaceTopic);

//     let inThisEnvironment = unnamespaced.filter(n => n.environment == process.env.NODE_ENV);

//     res.json(inThisEnvironment.map(n => n.topicName));
//   });
