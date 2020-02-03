"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../util/env");
const restify_errors_1 = require("restify-errors");
const node_fetch_1 = require("node-fetch");
const sandboxRequests = new Map();
const productionRequests = new Map();
class BatchTokenRequest {
    constructor(bundleName, sandbox, log) {
        this.devices = new Map();
        this.open = true;
        this.bundleName = bundleName;
        this.sandbox = sandbox;
        this.log = log;
    }
    getDeviceToken(token) {
        if (this.open === false) {
            throw new Error("Batch request has already been sent, cannot add another token");
        }
        return new Promise((fulfill, reject) => {
            this.devices.set(token, { fulfill, reject });
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.info("Running iOS device token request", { numberOfIds: this.devices.size });
            this.open = false;
            let objToSend = {
                application: this.bundleName,
                sandbox: this.sandbox,
                // sorting just for testing predictability, really
                apns_tokens: Array.from(this.devices.keys()).sort()
            };
            try {
                let res = yield node_fetch_1.default("https://iid.googleapis.com/iid/v1:batchImport", {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `key=${env_1.default.FIREBASE_AUTH_KEY}`
                    },
                    method: "POST",
                    body: JSON.stringify(objToSend)
                });
                let json = (yield res.json());
                // There are two places errors can occur here - an overall error with the
                // whole operation (e.g. auth error):
                if (json.error) {
                    const error = new restify_errors_1.InternalServerError(json.error.message);
                    for (const { reject } of this.devices.values()) {
                        reject(error);
                    }
                    return;
                }
                for (const [deviceToken, resolver] of this.devices) {
                    const result = json.results.find(r => r.apns_token === deviceToken);
                    if (!result) {
                        resolver.reject(new restify_errors_1.InternalServerError("Did not receive a Firebase ID for this token"));
                    }
                    else if (result.status !== "OK") {
                        resolver.reject(new restify_errors_1.InternalServerError("Unexpected status in token result: " + result.status));
                    }
                    else if (!result.registration_token) {
                        // should never happen, but let's safeguard against an external response we don't control
                        resolver.reject(new restify_errors_1.InternalServerError("Received no error, but no token either?"));
                    }
                    else {
                        resolver.fulfill(result.registration_token);
                    }
                }
            }
            catch (err) {
                for (const { reject } of this.devices.values()) {
                    reject(err);
                }
            }
        });
    }
}
// const sandbox
function getIdForiOSSubscription(sub, log) {
    return __awaiter(this, void 0, void 0, function* () {
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
            existingBundleRequest.running.run().then(function () {
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
        }
        else if (backOfTheQueue) {
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
    });
}
exports.getIdForiOSSubscription = getIdForiOSSubscription;
//# sourceMappingURL=get-ios-firebase-id.js.map