import {WebSubscription, iOSSubscription} from '../interface/subscription-types';
import * as fetch from 'node-fetch';
import * as bunyan from 'bunyan';
import * as restify from 'restify';
import * as querystring from 'querystring';

// We should have local cached copies of these rather than going to remote
// all the time. But for now we're only using it on subscribe and unsubscribe,
// so it's not so bad.

function getIdForWebSubscription(sub:WebSubscription):Promise<string> {

    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        throw new Error("Must send full notification payload in subscription object.");
    }

    let objToSend = {
        endpoint: sub.endpoint,
        encryption_key: sub.keys.p256dh,
        encryption_auth: sub.keys.auth,
        authorized_entity: process.env.FIREBASE_SENDER_ID
    }


    return fetch("https://fcm.googleapis.com/fcm/connect/subscribe", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        body: querystring.stringify(objToSend)
    })
    .then((res) => res.json())
    .then((json) => {
        
        if (json.error) {
            let error = new Error(json.error.message);
            error.name = json.error.message;
            throw error;
        }

        return json.token;
    })

}

function getIdForiOSSubscription(sub:iOSSubscription): Promise<string> {

    if (!sub.bundle_name) {
        throw new Error("Must provide iOS bundle name in bundle_name field.");
    }

    if (!sub.device_id) {
        throw new Error("Must provide iOS notification ID in device_id field.")
    }

    let objToSend = {
        application: sub.bundle_name,
        sandbox: false,
        apns_tokens: [
            sub.device_id
        ]   
    }

    if (sub.sandbox === true) {
        objToSend.sandbox = true;
    }

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
            throw new Error(json.results[0].status)
        }

        return json.results[0].registration_token;
    })
}

export const getFirebaseId:restify.RequestHandler = function (req, res, next) {

    let subscriptionObject = req.body["subscription"];

    return Promise.resolve()
    .then(() => {
        if (subscriptionObject.platform === "iOS") {
            return getIdForiOSSubscription(subscriptionObject as iOSSubscription);
        } else if (!subscriptionObject.platform) {
            return getIdForWebSubscription(subscriptionObject as WebSubscription);
        } else {
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
    })
}