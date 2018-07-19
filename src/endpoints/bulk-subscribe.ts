import fetch from "node-fetch";
import * as bunyan from "bunyan";
import Environment from "../util/env";
import { FCMBatchOperationResponse } from "../interface/fcm-responses";
import { PushkinRequestHandler } from "../util/request-handler";
import { BadRequestError } from "../../node_modules/@types/restify-errors";

type BatchOperation = "batchAdd" | "batchRemove";

async function sendRequest(operation: BatchOperation, topicName: string, ids: string[], log: bunyan) {
  log.info({ operation, topicName, numberOfIds: ids.length }, "Sending batch operation to Firebase...");
  let res = await fetch("https://iid.googleapis.com/iid/v1:" + operation, {
    method: "POST",
    headers: {
      Authorization: "key=" + Environment.FIREBASE_AUTH_KEY
    },
    body: JSON.stringify({
      to: "/topics/" + topicName,
      registration_tokens: ids
    })
  });

  let json: FCMBatchOperationResponse = await res.json();

  let errorCount = 0;

  json.results.forEach((result, idx) => {
    if (!result.error) {
      return;
    }
    let id = ids[idx];
    log.warn({ id, error: result.error }, "Received error in response to batch operation");
    errorCount++;
  });

  if (errorCount === 0) {
    log.info("Received successful batch operation response");
  } else {
    log.warn({ failures: errorCount }, "Received failures in response to batch operation");
  }

  return json.results;
}

interface BulkSubscriptionParams {
  topic_name: string;
}

interface BulkSubscriptionBody {
  ids: string[];
}

export const bulkSubscribeOrUnsubscribe: PushkinRequestHandler<
  BulkSubscriptionBody,
  BulkSubscriptionParams
> = async function(req, res, next) {
  try {
    if (!req.params.topic_name) {
      throw new BadRequestError("Topic was not provided");
    }

    if (!req.body.ids || req.body.ids.some(v => typeof v !== "string")) {
      throw new BadRequestError("Must send list of IDs and all of them must be strings");
    }

    if (req.body.ids.length > 1000) {
      throw new BadRequestError("Can only send up to 1000 IDs at once.");
    }

    let operation: BatchOperation = req.method === "POST" ? "batchAdd" : "batchRemove";

    let results = await sendRequest(operation, req.params.topic_name, req.body.ids, req.log);

    res.json(results);
  } catch (err) {
    req.log.warn({ err: err.message }, "Failure when trying to send batch operation");
    next(err);
  }
};
