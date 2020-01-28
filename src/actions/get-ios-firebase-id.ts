import * as Logger from "bunyan";
import { iOSSubscription } from "../interface/subscription-types";
import { FCMiOSRegistrationResponse, FCMiOSBatchRegistrationResponse } from "../interface/fcm-responses";
import Environment from "../util/env";
import { InternalServerError } from "restify-errors";
import fetch from "node-fetch";

interface StoredPromiseResolution<T> {
  fulfill: (value: T) => void;
  reject: (error: Error) => void;
}

const sandboxRequests = new Map<string, DeviceTokenFetch>();
const productionRequests = new Map<string, DeviceTokenFetch>();

class BatchTokenRequest {
  devices = new Map<string, StoredPromiseResolution<string>>();
  open = true;
  bundleName: string;
  sandbox: boolean;
  log: Logger;

  constructor(bundleName: string, sandbox: boolean, log: Logger) {
    this.bundleName = bundleName;
    this.sandbox = sandbox;
    this.log = log;
  }

  getDeviceToken(token: string): Promise<string> {
    if (this.open === false) {
      throw new Error("Batch request has already been sent, cannot add another token");
    }
    return new Promise((fulfill, reject) => {
      this.devices.set(token, { fulfill, reject });
    });
  }

  async run() {
    this.log.info("Running iOS device token request", { numberOfIds: this.devices.size });
    this.open = false;

    let objToSend = {
      application: this.bundleName,
      sandbox: this.sandbox,
      // sorting just for testing predictability, really
      apns_tokens: Array.from(this.devices.keys()).sort()
    };

    try {
      let res = await fetch("https://iid.googleapis.com/iid/v1:batchImport", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${Environment.FIREBASE_AUTH_KEY}`
        },
        method: "POST",
        body: JSON.stringify(objToSend)
      });

      let json = (await res.json()) as FCMiOSBatchRegistrationResponse;

      // There are two places errors can occur here - an overall error with the
      // whole operation (e.g. auth error):

      if (json.error) {
        const error = new InternalServerError(json.error.message);
        for (const { reject } of this.devices.values()) {
          reject(error);
        }
        return;
      }

      for (const [deviceToken, resolver] of this.devices) {
        const result = json.results.find(r => r.apns_token === deviceToken);
        if (!result) {
          resolver.reject(new InternalServerError("Did not receive a Firebase ID for this token"));
        } else if (result.status !== "OK") {
          resolver.reject(new InternalServerError("Unexpected status in token result: " + result.status));
        } else if (!result.registration_token) {
          // should never happen, but let's safeguard against an external response we don't control
          resolver.reject(new InternalServerError("Received no error, but no token either?"));
        } else {
          resolver.fulfill(result.registration_token);
        }
      }
    } catch (err) {
      for (const { reject } of this.devices.values()) {
        reject(err);
      }
    }
  }
}

interface DeviceTokenFetch {
  running?: BatchTokenRequest;
  pending: BatchTokenRequest[];
}

// const sandbox

export async function getIdForiOSSubscription(sub: iOSSubscription, log: Logger): Promise<string> {
  const targetMap = sub.sandbox ? sandboxRequests : productionRequests;

  let existingBundleRequest = targetMap.get(sub.bundle_name);
  if (!existingBundleRequest) {
    existingBundleRequest = { pending: [] };
    targetMap.set(sub.bundle_name, existingBundleRequest);
  }

  function onRunCompletion() {
    // This runs when a request is complete

    const firstInQueue = existingBundleRequest.pending.shift();

    if (!firstInQueue) {
      log.info("No more pending requests, queue is complete");
      existingBundleRequest.running = undefined;
      return;
    }
    log.info("Executing request queue.");
    existingBundleRequest.running = firstInQueue;
    existingBundleRequest.running.run().then(function() {
      log.info("Request execution complete");
      onRunCompletion();
    });
  }

  const backOfTheQueue = existingBundleRequest.pending[existingBundleRequest.pending.length - 1];

  if (backOfTheQueue && backOfTheQueue.devices.size < 100) {
    log.info("Already have a pending iOS device token stack, appending to it", {
      numberOfIds: backOfTheQueue.devices.size
    });
    // We already have a pending request, so let's add our request to that pile
    return backOfTheQueue.getDeviceToken(sub.device_id);
  } else if (backOfTheQueue) {
    log.warn("Reached 100 devices in pending queue. Starting another.");
  }

  log.info("Creating new device token request stack");
  // Otherwise we need to create a new request
  const newRequest = new BatchTokenRequest(sub.bundle_name, sub.sandbox, log);

  // and add our request
  const resultPromise = newRequest.getDeviceToken(sub.device_id);

  // Add this as our new pending request:
  existingBundleRequest.pending.push(newRequest);

  if (!existingBundleRequest.running) {
    log.info("There is no current device token request stack, executing immediately");
    // If there isn't actually a request running then let's immediately
    // promote this up to the running spot:
    onRunCompletion();
  }

  return resultPromise;
}
