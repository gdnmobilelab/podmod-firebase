import * as restify from "restify";
import * as bunyan from "bunyan";
import fetch, { Response } from "node-fetch";
import * as url from "url";
import { PushkinRequest, PushkinRequestHandler } from "../util/request-handler";
import { FCMMessage, FCMTokenMessage, MessageSendRequest } from "../interface/fcm-requests";
import { FCMSendMessageResponse } from "../interface/fcm-responses";
import { validate } from "jsonschema";
import Validators from "../../validators/validators";
import Environment from "../util/env";
import { join } from "path";
import { ValidationFailedError } from "../util/errors";
// const errorMessages: any = {
//   service_worker_url: "You must specify a service worker URL to receive the message (for iOS hybrid app)",
//   payload: "You must specify a payload to be sent to the remote device.",
//   ttl: "You must provide a time to live value.",
//   priority: "You must provide a priority of 'high' or 'normal'. Normal prioritises battery, high is faster."
// };

// const iOSMessages: any = {
//   title: "You must specify a title for the iOS fallback notification",
//   body: "You must specify a body for the iOS fallback notification"
// };

// export enum MessageSendType {
//   Registration,
//   Topic
// }

// export interface iOSFallbackNotification {
//   title: string;
//   body: string;
//   attachments: string[];
//   actions: string[];
//   collapse_id: string;
//   silent: boolean;
//   renotify: boolean;
// }

// export interface MessageSendBody {
//   service_worker_url: string;
//   payload: any;
//   ttl: number;
//   priority: "high" | "normal";
//   ios: iOSFallbackNotification;

//   // This is used by Firebase to replace push notifications that are still pending
//   // Not required as it only allows up to 4 at a time.
//   collapse_key?: string;
// }

// function checkForErrors(objToCheck: any, errorTypes: any): string[] {
//   let errors: string[] = [];

//   for (let key in errorTypes) {
//     if (!objToCheck[key]) {
//       errors.push(errorTypes[key]);
//     }
//   }

//   return errors;
// }

// interface Target {
//   registration?: string;
//   topics?: string[];
// }

// export function sendMessage(
//   target: Target,
//   msgType: MessageSendType,
//   body: MessageSendBody,
//   req: DbEnabledRequest
// ): Promise<string> {
//   let errors: string[] = [];

//   errors = errors.concat(checkForErrors(body, errorMessages));

//   if (errors.length > 0) {
//     req.log.error({ errors }, "Failed to send message");
//     throw new RestifyError(400, errors.join(", "));
//   }

//   // let iosAttachments: string = null;
//   // let iosActions: string = null;

//   // if (body.ios.attachments && body.ios.attachments.length > 0) {
//   //   // Firebase seems to send data as a string no matter what you do,
//   //   // so we might as well embrace it
//   //   iosAttachments = body.ios.attachments.join(",,,");
//   // }

//   // if (body.ios.actions) {
//   //   iosActions = body.ios.actions.join(",,,");
//   // }

//   let sendBody = {
//     to: undefined as any,
//     condition: undefined as any,
//     collapse_key: body.collapse_key,
//     content_available: true,
//     priority: body.priority,
//     mutable_content: true,
//     // click_action: "extended-content",
//     time_to_live: body.ttl,
//     data: {
//       send_time: String(Date.now()),
//       service_worker_url: body.service_worker_url,
//       payload: body.payload
//       // ios_attachments: iosAttachments,
//       // ios_actions: iosActions,
//       // ios_collapse_id: body.ios.collapse_id,
//       // ios_silent: String(body.ios.silent),
//       // ios_renotify: String(body.ios.renotify)
//     },
//     notification: {
//       title: body.ios.title,
//       body: body.ios.body
//     }
//   };
//   if (target.registration) {
//     sendBody.to = target.registration;
//   } else if (target.topics.length === 1) {
//     sendBody.to = `/topics/${target.topics[0]}`;
//   } else if (target.topics) {
//     sendBody.condition = "(" + target.topics.map(topic => `'${topic}' in topics`).join(" || ") + ")";
//   } else {
//     throw new Error("Could not understand target");
//   }

//   return fetch("https://fcm.googleapis.com/fcm/send", {
//     headers: {
//       Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`,
//       "Content-Type": "application/json"
//     },
//     method: "POST",
//     body: JSON.stringify(sendBody)
//   })
//     .then(res => {
//       if (msgType == MessageSendType.Registration) {
//         return parseRegistrationResponse(res, req.log);
//       } else {
//         return parseTopicResponse(res, req.log);
//       }
//     })
//     .then(finalId => {
//       req.log.info(
//         {
//           result_id: finalId
//         },
//         "Successfully sent message."
//       );
//       return finalId;
//     })
//     .catch(err => {
//       req.log.error(
//         {
//           error: err.message
//         },
//         "Failed to sent message"
//       );
//       throw err;
//     });
// }

// interface SendResponseParser {
//   (res: Response, log: bunyan): Promise<string>;
// }

// const parseRegistrationResponse: SendResponseParser = function(res, log) {
//   // return res.text()
//   //     .then((txt) => {
//   //         console.log(txt);
//   //         throw new Error("stop")
//   //         // return res.json()
//   //     })
//   return res.json().then(json => {
//     let sendResult = json.results[0];
//     if (sendResult.error) {
//       log.error(
//         {
//           error: sendResult.error,
//           multicast_id: json.multicast_id
//         },
//         "Attempt to send message failed."
//       );

//       throw new Error(sendResult.error);
//     }
//     return sendResult.message_id;
//   });
// };

// const parseTopicResponse: SendResponseParser = function(res, log) {
//   return res.text().then(text => {
//     return Promise.resolve()
//       .then(() => {
//         let json = JSON.parse(text);
//         // Firebase has no topic "creation" - you just subscribe to anything. But
//         // that also means a send never fails, it just successfully sends to zero
//         // subscribers. So there's not a lot of tracking we can do here, nor can I
//         // simulate an error. So we'll just have to JSON stringify the response if
//         // it isn't what we're expecting.

//         let messageId = json.message_id;

//         if (!messageId) {
//           log.error(
//             {
//               response: json
//             },
//             "Unknown error occurred when parsing topic response."
//           );
//           throw new Error("Unknown topic response error.");
//         }

//         return messageId;
//       })
//       .catch(err => {
//         log.error({ text }, "Could not parse JSON response");
//         throw new Error("JSON parse error");
//       });
//   });
// };

// export const sendMessageToTopic: DbEnabledRequestHandler = function(req, res, next) {
//   Promise.resolve()
//     .then(() => {
//       let parseIOSFromPayload = url.parse(req.url, true).query.iosFromPayload === "true";
//       let topicSelector = req.params["topic_name"];

//       let topics = topicSelector.split("+").map(namespaceTopic);

//       if (topics.length > 1) {
//         throw new Error("Cannot send to multiple topics until we solve bug with Firebase");
//       }

//       req.log.info(
//         {
//           target: topics,
//           action: "send",
//           sendType: "topic"
//         },
//         "Received request to send message."
//       );

//       return sendMessage({ topics }, MessageSendType.Topic, req.body, req);
//     })
//     .then(finalId => {
//       res.json({
//         id: finalId
//       });
//     })
//     .catch(err => {
//       next(err);
//     });
// };

export async function sendMessage(message: FCMTokenMessage, req: PushkinRequest) {
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
    throw new Error(jsonResponse.error.message);
  }

  req.log.info({ message_name: jsonResponse.name }, "Message successfully sent");

  return jsonResponse.name;
}

interface SendRegistrationParams {
  registration_id: string;
}

interface SendRegistrationBody {
  message: FCMMessage;
}

export const sendMessageToRegistration: PushkinRequestHandler<
  SendRegistrationBody,
  SendRegistrationParams
> = async function(req, res, next) {
  try {
    // Take the FCMMessage the user sent, and merge it with the registration ID to form
    // a token message send request.

    let mergedMessage: FCMTokenMessage = Object.assign({}, req.body.message, { token: req.params.registration_id });

    let validationResult = validate(mergedMessage, Validators.FCMTokenMessage);

    if (validationResult.errors.length > 0) {
      let err = new ValidationFailedError(
        "Request validation failed",
        (validationResult.errors as any[]).map(e => e.stack)
      );
      throw err;
    }

    let name = await sendMessage(mergedMessage, req);

    res.json({
      success: true,
      name
    });
  } catch (err) {
    next(err);
  }
};
