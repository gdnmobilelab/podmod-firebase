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
const env_1 = require("../util/env");
const restify_errors_1 = require("restify-errors");
const validate_1 = require("../validators/validate");
// API documentation for this:
// https://developers.google.com/instance-id/reference/server#create_relationship_maps_for_app_instances
function getIdForWebSubscription(sub, req) {
    return __awaiter(this, void 0, void 0, function* () {
        // Chrome has started sending an expirationTime key along with the rest of the subscription
        // and FCM throws an error if it's included. So let's filter to only the keys we know we need.
        let subscriptionToSend = {
            endpoint: sub.endpoint,
            keys: sub.keys
        };
        // check we have the right data types
        validate_1.validate(subscriptionToSend, "WebSubscription");
        let response = yield node_fetch_1.default("https://fcm.googleapis.com/fcm/connect/subscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                authorized_entity: env_1.default.FIREBASE_SENDER_ID,
                endpoint: subscriptionToSend.endpoint,
                encryption_key: subscriptionToSend.keys.p256dh,
                encryption_auth: subscriptionToSend.keys.auth,
                application_pub_key: env_1.default.VAPID_PUBLIC_KEY
            })
        });
        let json = (yield response.json());
        if (json.error) {
            throw new restify_errors_1.InternalServerError(json.error.message);
        }
        if (!json.token) {
            throw new restify_errors_1.InternalServerError("No error received, but no token is present either");
        }
        return json.token;
    });
}
function getIdForiOSSubscription(sub, req) {
    return __awaiter(this, void 0, void 0, function* () {
        validate_1.validate(sub, "iOSSubscription");
        if (env_1.default.PERMITTED_IOS_BUNDLES) {
            let allBundles = env_1.default.PERMITTED_IOS_BUNDLES.split(",").map(s => s.trim());
            if (allBundles.indexOf(sub.bundle_name) === -1) {
                throw new restify_errors_1.BadRequestError("iOS bundle name is not in the list of permitted bundles.");
            }
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
                Authorization: `key=${env_1.default.FIREBASE_AUTH_KEY}`
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
        try {
            let firebaseID;
            if (!req.body || !req.body.subscription) {
                throw new restify_errors_1.BadRequestError("You must send a 'subscription' object with the client push info.");
            }
            if (req.body.extra_info) {
                // This is a place to add any user-specific information that we can pull out of the DB later.
                req.log.info({ extra_info: req.body.extra_info }, "Extra information was sent with the request");
            }
            if (!req.body.subscription.platform) {
                firebaseID = yield getIdForWebSubscription(req.body.subscription, req);
            }
            else if (req.body.subscription.platform === "iOS") {
                firebaseID = yield getIdForiOSSubscription(req.body.subscription, req);
            }
            else {
                throw new restify_errors_1.BadRequestError("Unrecognised notification platform.");
            }
            req.log.info({ firebaseID, subscription: req.body.subscription }, "Successfully retreived Firebase ID for subscription.");
            res.json({
                id: firebaseID
            });
        }
        catch (err) {
            let target = "error";
            if (err instanceof restify_errors_1.BadRequestError) {
                // We only log at the error level for problems caused internally in pushkin.
                // If it's a 400 error it means the user provided bad data, so we just warn.
                target = "warn";
            }
            req.log[target]({
                subscription: req.body ? req.body.subscription : undefined,
                error: err.message
            }, "Failed to get Firebase ID for subscription.");
            next(err);
        }
    });
};
//# sourceMappingURL=get-firebase-id.js.map