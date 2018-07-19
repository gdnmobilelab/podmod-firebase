import fetch from "node-fetch";
import * as bunyan from "bunyan";
import Environment from "../util/env";
import { FCMBatchOperationResponse } from "../interface/fcm-responses";
import { PushkinRequestHandler } from "../util/request-handler";
import { BadRequestError } from "restify-errors";

type BatchOperation = "batchAdd" | "batchRemove";

async function sendRequest(operation: BatchOperation, topicName: string, ids: string[], log: bunyan) {
  log.info({ operation, topicName, numberOfIds: ids.length }, "Sending batch operation to Firebase...");
  let res = await fetch("https://iid.googleapis.com/iid/v1:" + operation, {
    method: "POST",
    headers: {
      Authorization: "key=" + Environment.FIREBASE_AUTH_KEY,
      "Content-Type": "application/json"
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
    let errors: { id: string; error: string }[] = [];
    let successfulIDs: string[] = [];

    results.forEach((result, idx) => {
      if (!result.error) {
        successfulIDs.push(req.body.ids[idx]);
        return;
      }
      errors.push({
        error: result.error,
        id: req.body.ids[idx]
      });
    });

    if (operation === "batchAdd") {
      // Postgres doesn't seem to have a good way to insert a lot of stuff at once, short of writing out
      // VALUES() a lot, so... let's do that?

      let values: string[] = [];
      let args = [req.params.topic_name];

      successfulIDs.forEach((id, idx) => {
        values.push(`($1, $${idx + 2})`);
        args.push(id);
      });

      await req.db.query(
        "INSERT INTO currently_subscribed (topic_id, firebase_id) VALUES " +
          values.join(",") +
          " ON CONFLICT DO NOTHING",
        args
      );
    } else {
      // Similarly there's no good way to say IN(argument_array) without declaring each variable. So
      // we have to do that, too.

      let args = [req.params.topic_name].concat(successfulIDs);
      let inArgs = successfulIDs.map((id, idx) => "$" + (idx + 2));

      await req.db.query(`DELETE FROM currently_subscribed WHERE topic_id = $1 AND firebase_id IN (${inArgs})`, args);
    }

    res.json({ errors });
  } catch (err) {
    console.log(err);
    req.log.warn({ err: err.message }, "Failure when trying to send batch operation");
    next(err);
  }
};
