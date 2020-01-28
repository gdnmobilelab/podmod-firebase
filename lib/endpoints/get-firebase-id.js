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
const jwt_1 = require("../util/jwt");
const get_ios_firebase_id_1 = require("../actions/get-ios-firebase-id");
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
        const { token } = yield jwt_1.getAccessToken();
        let response = yield node_fetch_1.default("https://iid.googleapis.com/v1/web/iid", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
                "Crypto-Key": "p256ecdsa=" + env_1.default.VAPID_PUBLIC_KEY
            },
            body: JSON.stringify(subscriptionToSend)
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
function getIdForiOSSubscriptionEndpoint(sub, req) {
    return __awaiter(this, void 0, void 0, function* () {
        validate_1.validate(sub, "iOSSubscription");
        if (env_1.default.PERMITTED_IOS_BUNDLES) {
            let allBundles = env_1.default.PERMITTED_IOS_BUNDLES.split(",").map(s => s.trim());
            if (allBundles.indexOf(sub.bundle_name) === -1) {
                throw new restify_errors_1.BadRequestError("iOS bundle name is not in the list of permitted bundles.");
            }
        }
        return get_ios_firebase_id_1.getIdForiOSSubscription(sub, req.log);
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
                firebaseID = yield getIdForiOSSubscriptionEndpoint(req.body.subscription, req);
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