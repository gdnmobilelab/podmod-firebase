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
const node_fetch_1 = require("node-fetch");
// API documentation for this:
// https://developers.google.com/instance-id/reference/server#create_relationship_maps_for_app_instances
function getIdForWebSubscription(sub) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
            throw new Error("Must send full notification payload in subscription object.");
        }
        // Chrome has started sending an expirationTime key along with the rest of the subscription
        // and FCM throws an error if it's included. So let's filter to only the keys we know we need.
        let subscriptionToSend = {
            endpoint: sub.endpoint,
            keys: sub.keys
        };
        let response = yield node_fetch_1.default("https://iid.googleapis.com/v1/web/iid", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
            },
            body: JSON.stringify(subscriptionToSend)
        });
        let json = (yield response.json());
        if (json.error) {
            throw new Error(json.error.message);
        }
        if (!json.token) {
            throw new Error("No error received, but no token is present either");
        }
        return json.token;
    });
}
function getIdForiOSSubscription(sub, req) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sub.bundle_name) {
            throw new Error("Must provide iOS bundle name in bundle_name field.");
        }
        if (!sub.device_id) {
            throw new Error("Must provide iOS notification ID in device_id field.");
        }
        if ("sandbox" in sub === false) {
            throw new Error("Must provide the sandbox attribute in iOS subscription");
        }
        // This is actually a batch operation, but we're only sending one APNS token
        // each time, so the apns_tokens array always has a length of 1.
        let objToSend = {
            application: sub.bundle_name,
            sandbox: sub.sandbox,
            apns_tokens: [sub.device_id]
        };
        let res = yield node_fetch_1.default("https://iid.googleapis.com/iid/v1:batchImport", {
            headers: {
                "Content-Type": "application/json",
                Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
            },
            method: "POST",
            body: JSON.stringify(objToSend)
        });
        let json = (yield res.json());
        // There are two places errors can occur here - an overall error with the
        // whole operation (e.g. auth error):
        if (json.error) {
            throw new Error(json.error.message);
        }
        if (!json.results || json.results.length === 0) {
            // This should never happen, but you never know.
            req.log.error(json, "Did not understand response from FCM");
            throw new Error("No error returned, but we didn't get a response either?");
        }
        // Or an error specific to an APNS token. Since we're only ever sending one,
        // we only need to check the status of the first object.
        if (json.results[0].status !== "OK") {
            throw new Error(json.results[0].status);
        }
        return json.results[0].registration_token;
    });
}
exports.getFirebaseId = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let subscription = req.body["subscription"];
        try {
            let firebaseID;
            if (subscription.platform === "iOS") {
                firebaseID = yield getIdForiOSSubscription(subscription, req);
            }
            else if (!subscription.platform) {
                // If there is no platform key it (presumably) means we're being sent
                // a web subscription.
                firebaseID = yield getIdForWebSubscription(subscription);
            }
            else {
                throw new Error("Unrecognised notification platform.");
            }
            req.log.info({ firebaseID, subscription }, "Successfully retreived Firebase ID for subscription.");
            res.json({
                id: firebaseID
            });
        }
        catch (err) {
            req.log.error({
                subscription,
                error: err.message
            }, "Failed to get Firebase ID for subscription.");
            next(err);
        }
    });
};
//# sourceMappingURL=get-firebase-id.js.map