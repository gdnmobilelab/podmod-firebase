import * as restify from "restify";
import { namespaceTopic } from "../util/namespace-topic";
import fetch from "node-fetch";
import * as bunyan from "bunyan";

function intoBatchesOf50(initialArray: any[]): any[][] {
  let returnArrays: any[][] = [];

  while (initialArray.length > 0) {
    returnArrays.push(initialArray.splice(0, 50));
  }

  return returnArrays;
}

function sendToFirebase(ids: any[], topic: string, action: "subscribe" | "unsubscribe") {
  let endpoint = action == "subscribe" ? "batchAdd" : "batchRemove";

  let stringifiedBody = JSON.stringify({
    to: `/topics/${topic}`,
    registration_tokens: ids
  });

  return fetch(`https://iid.googleapis.com/iid/v1:${endpoint}`, {
    headers: {
      Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`,
      "Content-Type": "application/json"
    },
    method: "POST",
    body: stringifiedBody
  })
    .then(res => res.json())
    .then((json: any) => {
      if (json.error) {
        throw new Error(json.error);
      }
      return json.results;
    });
}

function processBatches(
  batches: any[][],
  topic: string,
  action: "subscribe" | "unsubscribe",
  log: bunyan,
  index: number = 0,
  resultBatches: any[][] = []
): Promise<any[][]> {
  let targetBatch = batches[index];

  if (!targetBatch) {
    return Promise.resolve(resultBatches);
  }

  return sendToFirebase(targetBatch, topic, action).then(results => {
    results.forEach((result: any, i: number) => {
      result.id = targetBatch[i];
      if (result.error) {
        log.error({ error: result.error, id: targetBatch[i] }, "Operation failed for this ID");
      } else {
        result.success = true;
        log.info({ id: targetBatch[i] }, "Operation succeeded for this ID");
      }
    });
    resultBatches.push(results);
    return processBatches(batches, topic, action, log, index + 1, resultBatches);
  });
}

export function batchOperation(action: "subscribe" | "unsubscribe"): restify.RequestHandler {
  return function(req, res, next) {
    Promise.resolve()
      .then(() => {
        let topic = namespaceTopic(req.params["topic_name"]);

        req.log.info({ action, batch: true, topicName: topic }, "Received batch request");

        if (!(req.body instanceof Array)) {
          throw new Error("Must provide an array of IDs in the body");
        }

        let batches = intoBatchesOf50(req.body);

        return processBatches(batches, topic, action, req.log);
      })
      .then(resultBatches => {
        let final: any[] = [];
        resultBatches.forEach(b => (final = final.concat(b)));
        res.json(final);
      })
      .catch(err => {
        req.log.error({ error: err.message });
        next(err);
      });
  };
}
