import * as restify from "restify";
import fetch from "node-fetch";
import * as bunyan from "bunyan";
// import { sendMessage, MessageSendType, MessageSendBody } from "./send-message";
import { PushkinRequestHandler } from "../util/request-handler";
import { BadRequestError, InternalServerError } from "restify-errors";
import { FCMTokenMessage, FCMMessage } from "../interface/fcm-requests";
import { sendMessage } from "./send-message";
import Environment from "../util/env";
import { namespaceTopic } from "../util/namespace";
import { validate } from "../validators/validate";
import { JSONifyError } from "../util/jsonify-error";

async function sendRequest(id: string, topicName: string, method: string, log: bunyan): Promise<boolean> {
  let namespacedTopic = namespaceTopic(topicName);

  let url = `https://iid.googleapis.com/iid/v1/${id}/rel/topics/${namespacedTopic}`;
  log.info({ url, method }, "Sending request to Firebase");
  let res = await fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${Environment.FIREBASE_AUTH_KEY}`
    }
  });

  if (res.status === 200) {
    return true;
  }

  let contentType = res.headers.get("content-type");

  if (contentType !== "application/json" && res.status === 403) {
    // The forbidden responses come in as HTML (for whatever reason)
    throw new BadRequestError("Received a 403 Forbidden error from Firebase");
  }

  let json = await res.json();

  if (json.error === "InvalidToken") {
    throw new BadRequestError(`FCM did not recognise client token`);
  }

  throw new InternalServerError(json.error);
}

interface SubscriptionParams {
  topic_name: string;
  registration_id: string;
}

interface SubscriptionBody {
  confirmation?: FCMMessage;
}

export const subscribeOrUnsubscribe: PushkinRequestHandler<
  SubscriptionBody | undefined,
  SubscriptionParams
> = async function(req, res, next) {
  // let confirmationNotification: MessageSendBody = req.body["confirmation_notification"];

  try {
    let action = req.method == "POST" ? "subscribe" : "unsubscribe";

    req.log.info({ action, topic: req.params.topic_name, id: req.params.registration_id }, "Received request.");

    await sendRequest(req.params.registration_id, req.params.topic_name, req.method, req.log);
    req.log.info({ success: true }, "Firebase request was successful");

    let query = "INSERT INTO currently_subscribed (firebase_id, topic_id) VALUES ($1, $2)";

    if (action === "unsubscribe") {
      query = "DELETE FROM currently_subscribed WHERE firebase_id = $1 AND topic_id = $2";
    }

    await req.db.query(query, [req.params.registration_id, req.params.topic_name]);

    if (req.body && req.body.confirmation) {
      validate(req.body.confirmation, "FCMMessage");

      req.log.info({ confirmation: req.body.confirmation }, "Sending confirmation notification");

      let mergedMessage: FCMTokenMessage = Object.assign({}, req.body.confirmation, {
        token: req.params.registration_id
      });

      try {
        await sendMessage(mergedMessage, req);
      } catch (err) {
        req.log.error({ error: err.message }, "Failed to send confirmation notification");
        throw err;
      }
    }

    res.json({
      subscribed: action === "subscribe"
    });
  } catch (err) {
    req.log.warn({ error: JSONifyError(err) }, "Failure when trying to set subscription action");
    next(err);
  }
};
