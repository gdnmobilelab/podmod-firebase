"use strict";
const fetch = require('node-fetch');
const send_message_1 = require('./send-message');
function sendRequest(id, topicName, method, log) {
    return fetch(`https://iid.googleapis.com/iid/v1/${id}/rel/topics/${topicName}`, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `key=${process.env.FIREBASE_AUTH_KEY}`
        },
    })
        .then((res) => {
        return res.json()
            .then((json) => {
            if (res.status != 200) {
                throw new Error(json.error);
            }
            return true;
        });
    })
        .then(() => {
        log.info({
            method: method
        }, "Successful request to Firebase.");
        return true;
    })
        .catch((err) => {
        log.error({
            method: method,
            error: err.message
        }, "Request to Firebase failed.");
        throw err;
    });
}
exports.subscribeOrUnsubscribe = function (req, res, next) {
    let topicName = req.params["topic_name"];
    let id = req.params["registration_id"];
    let confirmationNotification = req.body["confirmation_notification"];
    let serviceWorkerURL = req.body["service_worker_url"];
    if (confirmationNotification && !serviceWorkerURL) {
        throw new Error("If you provide a confirmation_notification you must also send the service_worker_url field.");
    }
    let action = req.method == "POST" ? "subscribe" : "unsubscribe";
    req.log.info({ action, topicName, id }, "Received request.");
    return sendRequest(id, topicName, req.method, req.log)
        .then(() => {
        if (!confirmationNotification) {
            return null;
        }
        let sendObj = {
            payload: confirmationNotification,
            ttl: 60,
            priority: "high",
            service_worker_url: serviceWorkerURL
        };
        return send_message_1.sendMessage(id, send_message_1.MessageSendType.Registration, sendObj, req.log);
    })
        .then((messageId) => {
        let json = {
            subscribed: action === "subscribe"
        };
        if (messageId) {
            json.confirmationNotificationId = messageId;
        }
        res.json(json);
    })
        .catch((err) => {
        next(err);
    });
};
//# sourceMappingURL=subscribe.js.map