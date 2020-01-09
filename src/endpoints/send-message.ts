import fetch, { Response } from "node-fetch";
import * as url from "url";
import { PushkinRequest, PushkinRequestHandler } from "../util/request-handler";
import {
  FCMMessage,
  FCMTokenMessage,
  MessageSendRequest,
  FCMTopicMessage,
  FCMConditionMessage
} from "../interface/fcm-requests";
import { FCMSendMessageResponse } from "../interface/fcm-responses";
import { validate, ValidatorDefinition } from "../validators/validate";
import Environment from "../util/env";
import { ValidationFailedError } from "../util/errors";
import { namespaceTopic, namespaceCondition } from "../util/namespace";
import { InternalServerError, BadRequestError } from "restify-errors";
import { getAccessToken } from "../util/jwt";

export async function sendMessage(
  message: FCMTokenMessage | FCMTopicMessage | FCMConditionMessage,
  req: PushkinRequest
) {
  req.log.info(message, "Trying to send a message");

  let sendBody: MessageSendRequest = {
    message,
    validate_only: false
  };

  let { token } = await getAccessToken();
  let res = await fetch(`https://fcm.googleapis.com/v1/projects/${Environment.FCM_PROJECT}/messages:send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify(sendBody)
  });

  let jsonResponse: FCMSendMessageResponse = await res.json();

  if (jsonResponse.error) {
    req.log.error(jsonResponse.error, "Encountered error when trying to send message");
    throw new InternalServerError(jsonResponse.error.message);
  }

  req.log.info({ message_name: jsonResponse.name }, "Message successfully sent");

  return jsonResponse.name;
}

interface SendRegistrationParams {
  registration_id: string;
}

interface SendMessageBody {
  message: FCMMessage;
}

export const sendMessageToRegistration: PushkinRequestHandler<SendMessageBody, SendRegistrationParams> = async function(
  req,
  res,
  next
) {
  try {
    req.log.info(
      {
        action: "send-message",
        target_type: "registration",
        topic: req.params.registration_id
      },
      "Received request to send message"
    );

    // Take the FCMMessage the user sent, and merge it with the registration ID to form
    // a token message send request.

    let mergedMessage: FCMTokenMessage = Object.assign({}, req.body.message, { token: req.params.registration_id });

    validate(mergedMessage, "FCMTokenMessage");

    let name = await sendMessage(mergedMessage, req);

    req.log.info({ name }, "Successfully sent message");

    res.json({
      success: true,
      name
    });
  } catch (err) {
    let target: "error" | "warn" = "error";
    if (err instanceof BadRequestError || err instanceof ValidationFailedError) {
      target = "warn";
    }
    req.log[target]({ error: err.message }, "Failed to send message");
    next(err);
  }
};

interface SendTopicParams {
  topic_name: string;
}

export const sendMessageToTopic: PushkinRequestHandler<SendMessageBody, SendTopicParams> = async function(
  req,
  res,
  next
) {
  try {
    let namespacedTopic = namespaceTopic(req.params.topic_name);

    req.log.info(
      {
        action: "send-message",
        target_type: "topic",
        topic: req.params.topic_name,
        namespaced: namespacedTopic
      },
      "Received request to send message"
    );

    let mergedMessage: FCMTopicMessage = Object.assign({}, req.body.message, { topic: namespacedTopic });

    validate(mergedMessage, "FCMTopicMessage");

    let name = await sendMessage(mergedMessage, req);

    req.log.info({ name }, "Successfully sent message");

    res.json({
      success: true,
      name
    });
  } catch (err) {
    let target: "error" | "warn" = "error";
    if (err instanceof BadRequestError || err instanceof ValidationFailedError) {
      target = "warn";
    }
    req.log[target]({ error: err.message }, "Failed to send message");
    next(err);
  }
};

interface SendTopicBody {
  condition: string;
}

export const sendMessageToCondition: PushkinRequestHandler<SendMessageBody & SendTopicBody, void> = async function(
  req,
  res,
  next
) {
  try {
    if (!req.body.condition) {
      throw new BadRequestError("Must specify a 'condition' to send a message");
    }

    let namespacedCondition = namespaceCondition(req.body.condition);

    req.log.info(
      {
        action: "send-message",
        target_type: "condition",
        condition: req.body.condition,
        namespaced: namespacedCondition
      },
      "Received request to send message"
    );

    let mergedMessage: FCMConditionMessage = Object.assign({}, req.body.message, { condition: namespacedCondition });

    validate(mergedMessage, "FCMConditionMessage");

    let name = await sendMessage(mergedMessage, req);

    req.log.info({ name }, "Successfully sent message");

    res.json({
      success: true,
      name
    });
  } catch (err) {
    let target: "error" | "warn" = "error";
    if (err instanceof BadRequestError || err instanceof ValidationFailedError) {
      target = "warn";
    }
    req.log[target]({ error: err.message }, "Failed to send message");
    next(err);
  }
};
