import fetch from "node-fetch";
import * as bunyan from "bunyan";
import Environment from "../util/env";
import { namespaceTopic } from "../util/namespace";
import { FCMBatchOperationResponse } from "../interface/fcm-responses";
import { PushkinRequestHandler } from "../util/request-handler";
import { BadRequestError } from "restify-errors";

type BatchOperation = "batchAdd" | "batchRemove";

async function sendRequest(operation: BatchOperation, topicName: string, ids: string[], log: bunyan) {
  let namespacedTopic = namespaceTopic(topicName);
  log.info(
    { operation, namespacedTopic, topicName, numberOfIds: ids.length },
    "Sending batch operation to Firebase..."
  );
  let res = await fetch("https://iid.googleapis.com/iid/v1:" + operation, {
    method: "POST",
    headers: {
      Authorization: "key=" + Environment.FIREBASE_AUTH_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: "/topics/" + namespacedTopic,
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

    let duplicatedIds: string[] = [];

    let uniqueIds = req.body.ids.reduce((arr, id, idx) => {
      if (arr.indexOf(id) > -1) {
        duplicatedIds.push(id);
      } else {
        arr.push(id);
      }
      return arr;
    }, []);

    let operation: BatchOperation = req.method === "POST" ? "batchAdd" : "batchRemove";

    let results = await sendRequest(operation, req.params.topic_name, uniqueIds, req.log);
    let errors: { id: string; error: string }[] = [];
    let successfulIDs: string[] = [];

    results.forEach((result, idx) => {
      if (!result.error) {
        successfulIDs.push(uniqueIds[idx]);
        return;
      }
      errors.push({
        error: result.error,
        id: uniqueIds[idx]
      });
    });

    if (operation === "batchAdd") {
      // as suggested here: https://github.com/brianc/node-postgres/issues/957#issuecomment-295583050

      await req.db.query(
        "INSERT INTO currently_subscribed (topic_id, firebase_id) SELECT $1, * FROM UNNEST ($2::text[]) ON CONFLICT DO NOTHING",
        [req.params.topic_name, successfulIDs]
      );
    } else {
      await req.db.query(
        `DELETE FROM currently_subscribed WHERE topic_id = $1 AND firebase_id IN (SELECT * FROM UNNEST ($2::text[]))`,
        [req.params.topic_name, successfulIDs]
      );
    }

    let warnings = duplicatedIds.map(id => {
      return {
        id,
        warning: "This ID was included more than once in the request body"
      };
    });

    res.json({ errors, warnings });
  } catch (err) {
    req.log.warn({ err: err.message }, "Failure when trying to send batch operation");
    next(err);
  }
};
