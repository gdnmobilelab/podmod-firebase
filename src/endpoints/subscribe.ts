import * as restify from "restify";
import fetch from "node-fetch";
import * as bunyan from "bunyan";
// import { sendMessage, MessageSendType, MessageSendBody } from "./send-message";
import { PushkinRequestHandler } from "../util/request-handler";
import { BadRequestError, InternalServerError } from "restify-errors";
import { FCMTokenMessage, FCMMessage } from "../interface/fcm-requests";
import { sendMessage } from "./send-message";

async function sendRequest(id: string, topicName: string, method: string, log: bunyan): Promise<boolean> {
  let res = await fetch(`https://iid.googleapis.com/iid/v1/${id}/rel/topics/${topicName}`, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
    }
  });

  let json = await res.json();

  if (res.status === 200) {
    return true;
  }

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

    if (req.body && req.body.confirmation) {
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
    next(err);
  }
};
