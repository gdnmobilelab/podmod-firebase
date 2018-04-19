import fetch, { Response } from "node-fetch";
import * as url from "url";
import { PushkinRequest, PushkinRequestHandler } from "../util/request-handler";
import { FCMMessage, FCMTokenMessage, MessageSendRequest, FCMTopicMessage } from "../interface/fcm-requests";
import { FCMSendMessageResponse } from "../interface/fcm-responses";
import { Validator } from "jsonschema";
import Validators from "../validators/validators";
import Environment from "../util/env";
import { join } from "path";
import { ValidationFailedError } from "../util/errors";
import { namespaceTopic } from "../util/namespace";
import { InternalServerError } from "restify-errors";

const validator = new Validator();
validator.addSchema(Validators);

export async function sendMessage(message: FCMTokenMessage | FCMTopicMessage, req: PushkinRequest) {
  req.log.info(message, "Trying to send a message");

  let sendBody: MessageSendRequest = {
    message,
    validate_only: false
  };

  let { token } = await req.jwt.getAccessToken();
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

function doValidationCheck(obj: any, validation: any) {
  let validationResult = validator.validate(obj, validation);

  if (validationResult.errors.length > 0) {
    let err = new ValidationFailedError(
      "Request validation failed",
      (validationResult.errors as any[]).map(e => e.stack)
    );
    throw err;
  }
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

    doValidationCheck(mergedMessage, Validators.definitions.FCMTokenMessage);

    let name = await sendMessage(mergedMessage, req);

    req.log.info({ name }, "Successfully sent message");

    res.json({
      success: true,
      name
    });
  } catch (err) {
    req.log.error({ error: err.message }, "Failed to send message");
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

    doValidationCheck(mergedMessage, Validators.definitions.FCMTopicMessage);

    let name = await sendMessage(mergedMessage, req);

    req.log.info({ name }, "Successfully sent message");

    res.json({
      success: true,
      name
    });
  } catch (err) {
    req.log.error({ error: err.message }, "Failed to send message");
    next(err);
  }
};
