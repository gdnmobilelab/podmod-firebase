"use strict";
const restify_error_1 = require('../util/restify-error');
const fetch = require('node-fetch');
const namespace_topic_1 = require('../util/namespace-topic');
const url = require('url');
const errorMessages = {
    'service_worker_url': "You must specify a service worker URL to receive the message (for iOS hybrid app)",
    'payload': "You must specify a payload to be sent to the remote device.",
    'ttl': "You must provide a time to live value.",
    'priority': "You must provide a priority of 'high' or 'normal'. Normal prioritises battery, high is faster.",
    'ios': "You must provide an 'ios' object with fallback notification content for iOS devices"
};
const iOSMessages = {
    'title': "You must specify a title for the iOS fallback notification",
    'body': "You must specify a body for the iOS fallback notification"
};
(function (MessageSendType) {
    MessageSendType[MessageSendType["Registration"] = 0] = "Registration";
    MessageSendType[MessageSendType["Topic"] = 1] = "Topic";
})(exports.MessageSendType || (exports.MessageSendType = {}));
var MessageSendType = exports.MessageSendType;
function checkForErrors(objToCheck, errorTypes) {
    let errors = [];
    for (let key in errorTypes) {
        if (!objToCheck[key]) {
            errors.push(errorTypes[key]);
        }
    }
    return errors;
}
function parseIOSNotificationFromPayload(payload) {
    if (!(payload instanceof Array)) {
        throw new Error("Payload is not an array, can't parse out iOS arguments");
    }
    let notificationShow = payload.find((p) => p.command === "notification.show");
    if (!notificationShow) {
        throw new Error("There is no notification.show command in the payload to parse into iOS arguments");
    }
    let commandOptions = notificationShow.options;
    let notificationOptions = commandOptions.options;
    let collapsed = notificationOptions.collapsed || {};
    let attachments = [];
    if (notificationOptions.video && notificationOptions.video.preload === true) {
        attachments.push(notificationOptions.video.url);
    }
    if (notificationOptions.image) {
        attachments.push(notificationOptions.image);
    }
    let actions = [];
    if (notificationOptions.actions) {
        actions = actions.concat(notificationOptions.actions.map((a) => a.title));
    }
    if (commandOptions.actionCommands) {
        actions = actions.concat(commandOptions.actionCommands.map((a) => a.template.title));
    }
    let collapseId = null;
    if (notificationOptions.tag) {
        collapseId = notificationOptions.tag;
    }
    let silent = !!notificationOptions.silent;
    let renotify = !!notificationOptions.renotify;
    let iosNotification = {
        title: collapsed.title || commandOptions.title,
        body: collapsed.body || notificationOptions.body,
        attachments: attachments,
        actions: actions,
        collapse_id: collapseId,
        silent: silent,
        renotify: renotify
    };
    return iosNotification;
}
function sendMessage(target, msgType, body, log, parseIOSFromPayload) {
    let errors = [];
    if (body.ios) {
        if (parseIOSFromPayload === true) {
            errors.push("Cannot specify iosFromPayload as well as an ios key in payload");
        }
        errors = errors.concat(checkForErrors(body.ios, iOSMessages));
    }
    else if (parseIOSFromPayload) {
        // If we're using the lab's notification-commands library, we can parse out the notification being shown
        // from the payload.
        try {
            body.ios = parseIOSNotificationFromPayload(body.payload);
        }
        catch (err) {
            errors.push(err.message);
        }
    }
    errors = errors.concat(checkForErrors(body, errorMessages));
    if (errors.length > 0) {
        throw new restify_error_1.RestifyError(400, errors.join(', '));
    }
    let iosAttachments = null;
    let iosActions = null;
    if (body.ios.attachments && body.ios.attachments.length > 0) {
        // Firebase seems to send data as a string no matter what you do,
        // so we might as well embrace it
        iosAttachments = body.ios.attachments.join(',,,');
    }
    if (body.ios.actions) {
        iosActions = body.ios.actions.join(',,,');
    }
    let sendBody = {
        to: target,
        collapse_key: body.collapse_key,
        content_available: true,
        priority: body.priority,
        mutable_content: true,
        click_action: "extended-content",
        time_to_live: body.ttl,
        data: {
            send_time: String(Date.now()),
            service_worker_url: body.service_worker_url,
            payload: body.payload,
            ios_attachments: iosAttachments,
            ios_actions: iosActions,
            ios_collapse_id: body.ios.collapse_id,
            ios_silent: String(body.ios.silent),
            ios_renotify: String(body.ios.renotify)
        },
        notification: {
            title: body.ios.title,
            body: body.ios.body
        }
    };
    return fetch('https://fcm.googleapis.com/fcm/send', {
        headers: {
            'Authorization': `key=${process.env.FIREBASE_AUTH_KEY}`,
            'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(sendBody)
    })
        .then((res) => {
        if (msgType == MessageSendType.Registration) {
            return parseRegistrationResponse(res, log);
        }
        else {
            return parseTopicResponse(res, log);
        }
    })
        .then((finalId) => {
        log.info({
            result_id: finalId
        }, "Successfully sent message.");
        return finalId;
    })
        .catch((err) => {
        log.error({
            error: err.message
        }, "Failed to sent message");
        throw err;
    });
}
exports.sendMessage = sendMessage;
const parseRegistrationResponse = function (res, log) {
    return res.json()
        .then((json) => {
        let sendResult = json.results[0];
        if (sendResult.error) {
            log.error({
                error: sendResult.error,
                multicast_id: json.multicast_id
            }, "Attempt to send message failed.");
            throw new Error(sendResult.error);
        }
        return sendResult.message_id;
    });
};
const parseTopicResponse = function (res, log) {
    return res.json()
        .then((json) => {
        // Firebase has no topic "creation" - you just subscribe to anything. But
        // that also means a send never fails, it just successfully sends to zero
        // subscribers. So there's not a lot of tracking we can do here, nor can I
        // simulate an error. So we'll just have to JSON stringify the response if
        // it isn't what we're expecting.
        let messageId = json.message_id;
        if (!messageId) {
            log.error({
                response: json
            }, "Unknown error occurred when parsing topic response.");
            throw new Error("Unknown topic response error.");
        }
        return messageId;
    });
};
exports.sendMessageToTopic = function (req, res, next) {
    Promise.resolve()
        .then(() => {
        let parseIOSFromPayload = url.parse(req.url, true).query.iosFromPayload === "true";
        let topicName = namespace_topic_1.namespaceTopic(req.params['topic_name']);
        req.log.info({
            target: topicName,
            action: 'send',
            sendType: 'topic'
        }, "Received request to send message.");
        return sendMessage(`/topics/${topicName}`, MessageSendType.Topic, req.body, req.log, parseIOSFromPayload);
    })
        .then((finalId) => {
        res.json({
            id: finalId
        });
    })
        .catch((err) => {
        next(err);
    });
};
exports.sendMessageToRegistration = function (req, res, next) {
    Promise.resolve()
        .then(() => {
        let parseIOSFromPayload = url.parse(req.url, true).query.iosFromPayload === "true";
        let registration = req.params['registration_id'];
        req.log.info({
            target: registration,
            action: 'send',
            sendType: 'registration'
        }, "Received request to send message.");
        return sendMessage(registration, MessageSendType.Registration, req.body, req.log, parseIOSFromPayload);
    })
        .then((finalId) => {
        res.json({
            id: finalId
        });
    })
        .catch((err) => {
        next(err);
    });
};
//# sourceMappingURL=send-message.js.map