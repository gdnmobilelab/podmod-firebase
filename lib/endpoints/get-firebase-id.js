"use strict";
const fetch = require('node-fetch');
// We should have local cached copies of these rather than going to remote
// all the time. But for now we're only using it on subscribe and unsubscribe,
// so it's not so bad.
function getIdForWebSubscription(sub) {
    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        throw new Error("Must send full notification payload in subscription object.");
    }
    let objToSend = {
        endpoint: sub.endpoint,
        encryption_key: sub.keys.p256dh,
        encryption_auth: sub.keys.auth,
        authorized_entity: process.env.FIREBASE_SENDER_ID
    };
    return fetch("https://jmt17.google.com/dev/fcm/connect/subscribe", {
        headers: {
            "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify(objToSend)
    })
        .then((res) => res.json())
        .then((json) => {
        if (json.error) {
            let error = new Error(json.error.message);
            error.name = json.error.message;
            throw error;
        }
        return json.token;
    });
}
function getIdForiOSSubscription(sub) {
    if (!sub.bundle_name) {
        throw new Error("Must provide iOS bundle name in bundle_name field.");
    }
    if (!sub.device_id) {
        throw new Error("Must provide iOS notification ID in device_id field.");
    }
    let objToSend = {
        application: sub.bundle_name,
        sandbox: process.env.NODE_ENV !== "production",
        apns_tokens: [
            sub.device_id
        ]
    };
    return fetch("https://iid.googleapis.com/iid/v1:batchImport", {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `key=${process.env.FIREBASE_AUTH_KEY}`
        },
        method: "POST",
        body: JSON.stringify(objToSend)
    })
        .then((res) => res.json())
        .then((json) => {
        if (json.error) {
            throw new Error(json.error);
        }
        if (json.results[0].status !== "OK") {
            throw new Error(json.results[0].status);
        }
        return json.results[0].registration_token;
    });
}
exports.getFirebaseId = function (req, res, next) {
    let subscriptionObject = req.body["subscription"];
    return Promise.resolve()
        .then(() => {
        if (subscriptionObject.platform === "iOS") {
            return getIdForiOSSubscription(subscriptionObject);
        }
        else if (!subscriptionObject.platform) {
            return getIdForWebSubscription(subscriptionObject);
        }
        else {
            throw new Error("Unrecognised notification platform.");
        }
    })
        .then((id) => {
        req.log.info({
            id: id,
            subscription: subscriptionObject
        }, "Successfully retreived Firebase ID for subscription.");
        res.json({
            id: id
        });
    })
        .catch((err) => {
        req.log.error({
            subscription: subscriptionObject,
            error: err.message
        }, "Failed to get Firebase ID for subscription.");
        next(err);
    });
};
//# sourceMappingURL=get-firebase-id.js.map