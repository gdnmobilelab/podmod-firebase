import * as restify from 'restify';
import {RestifyError} from '../util/restify-error';
import * as bunyan from 'bunyan';
import * as fetch from 'node-fetch';
import {namespaceTopic} from '../util/namespace-topic';
import * as url from 'url';

const errorMessages:any = {
    'service_worker_url': "You must specify a service worker URL to receive the message (for iOS hybrid app)",
    'payload': "You must specify a payload to be sent to the remote device.",
    'ttl': "You must provide a time to live value.",
    'priority': "You must provide a priority of 'high' or 'normal'. Normal prioritises battery, high is faster.",
    'ios' : "You must provide an 'ios' object with fallback notification content for iOS devices"
}

const iOSMessages:any = {
    'title': "You must specify a title for the iOS fallback notification",
    'body': "You must specify a body for the iOS fallback notification"
}

export enum MessageSendType {
    Registration,
    Topic
}

export interface iOSFallbackNotification {
    title: string;
    body: string;
    attachments: string[];
    actions: string[];
    collapse_id: string;
    silent: boolean;
    renotify: boolean;
}

export interface MessageSendBody {
    service_worker_url: string;
    payload: any;
    ttl: number;
    priority: 'high' | 'normal';
    ios: iOSFallbackNotification;

    // This is used by Firebase to replace push notifications that are still pending
    // Not required as it only allows up to 4 at a time.
    collapse_key?: string
}

function checkForErrors(objToCheck: any, errorTypes: any): string[] {

    let errors:string[] = [];

    for (let key in errorTypes) {
        if (!objToCheck[key]) {
            errors.push(errorTypes[key]);
        }
    }

    return errors;
}

function parseIOSNotificationFromPayload(payload: any) : iOSFallbackNotification {
    
    if (!(payload instanceof Array)) {
        throw new Error("Payload is not an array, can't parse out iOS arguments");
    }
    

    let notificationShow = (payload as any[]).find((p) => p.command === "notification.show");

    if (!notificationShow) {
        throw new Error("There is no notification.show command in the payload to parse into iOS arguments");
    }

    let commandOptions = notificationShow.options;
    let notificationOptions = commandOptions.options;
    let collapsed = notificationOptions.collapsed || {};

    let attachments: any[] = [];

    if (notificationOptions.video && notificationOptions.video.preload === true) {
        attachments.push(notificationOptions.video.url);
    }

    if (notificationOptions.image) {
        attachments.push(notificationOptions.image);
    }

    let actions:any[] = [];

    if (notificationOptions.actions) {
        actions = actions.concat(notificationOptions.actions.map((a:any) => a.title));
    }
    if (commandOptions.actionCommands) {
        actions = actions.concat(commandOptions.actionCommands.map((a:any) => a.template.title));
    }

    let collapseId:string = null;
    if (notificationOptions.tag) {
        collapseId = notificationOptions.tag;
    }

    let silent = !!notificationOptions.silent
    let renotify = !!notificationOptions.renotify

    let iosNotification:iOSFallbackNotification = {
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

interface Target {
    registration?: string;
    topics?: string[];
}

export function sendMessage(target:Target, msgType: MessageSendType, body: MessageSendBody, log:bunyan.Logger, parseIOSFromPayload:boolean):Promise<string> {
    
    let errors:string[] = [];

    if (body.ios) {

        // Removing the below as the version of the webapp that ships with the App Store version
        // currently does this, and we can't be 100% sure a user update will have succeeded.

        // if (parseIOSFromPayload === true) {
        //     errors.push("Cannot specify iosFromPayload as well as an ios key in payload");
        // }
        errors = errors.concat(checkForErrors(body.ios, iOSMessages));
    } else if (parseIOSFromPayload) {
        
        // If we're using the lab's notification-commands library, we can parse out the notification being shown
        // from the payload.

        try {
            body.ios = parseIOSNotificationFromPayload(body.payload);
        } catch (err) {
            errors.push(err.message);
        }

    }

    errors = errors.concat(checkForErrors(body, errorMessages));

    if (errors.length > 0) {
        log.error({errors}, "Failed to send message")
        throw new RestifyError(400, errors.join(', '))
    }

    let iosAttachments:string = null;
    let iosActions:string = null;

    if (body.ios.attachments && body.ios.attachments.length > 0) {
        // Firebase seems to send data as a string no matter what you do,
        // so we might as well embrace it
        iosAttachments = body.ios.attachments.join(',,,');
    }

    if (body.ios.actions) {
        iosActions = body.ios.actions.join(',,,');
    }

    let sendBody = {
        to: undefined as any,
        condition: undefined as any,
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
    }
    if (target.registration) {
        sendBody.to = target.registration;
    } else if (target.topics.length === 1) {
        sendBody.to = `/topics/${target.topics[0]}`;
    } else if (target.topics) {
        sendBody.condition = "(" + target.topics
            .map((topic) => `'${topic}' in topics`)
            .join(' || ') + ")";
    } else {
        throw new Error("Could not understand target");
    }

  
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
        } else {
            return parseTopicResponse(res, log);
        }
    })
    .then((finalId) => {
        log.info({
            result_id: finalId
        }, "Successfully sent message.");
        return finalId
    })
    .catch((err) => {
        log.error({
            error: err.message
        }, "Failed to sent message");
        throw err;
    })
}

interface SendResponseParser {
    (res:_fetch.Response, log: bunyan.Logger):Promise<string>;
}

const parseRegistrationResponse:SendResponseParser = function(res, log) {
    return res.json()
    // .then((txt) => {
    //     console.log(txt);
    //     return res.json()
    // })
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
    })
}

const parseTopicResponse:SendResponseParser = function(res, log) {
    return res.text()
    .then((text) => {
        return Promise.resolve()
        .then(() => {
            let json = JSON.parse(text);
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
        })
        .catch((err) => {
            log.error({text}, "Could not parse JSON response");
            throw new Error("JSON parse error");
        })
        
    });
}

export const sendMessageToTopic:restify.RequestHandler = function(req, res, next) {
    
    Promise.resolve()
    .then(() => {
        let parseIOSFromPayload = url.parse(req.url, true).query.iosFromPayload === "true";
        let topicSelector = req.params['topic_name'];

        let topics = topicSelector
            .split("+")
            .map(namespaceTopic);


        if (topics.length > 1) {
            throw new Error("Cannot send to multiple topics until we solve bug with Firebase");
        }

        req.log.info({
            target: topics,
            action: 'send',
            sendType: 'topic'
        }, "Received request to send message.")

        return sendMessage({topics}, MessageSendType.Topic, req.body, req.log, parseIOSFromPayload);
    })
    .then((finalId) => {
        res.json({
            id: finalId
        });
    })
    .catch((err) => {
        next(err);
    })
}

export const sendMessageToRegistration:restify.RequestHandler = function(req, res, next) {
    
    Promise.resolve()
    .then(() => {
        
        let parseIOSFromPayload = url.parse(req.url, true).query.iosFromPayload === "true";
        let registration = req.params['registration_id'] as string;

        req.log.info({
            target: registration,
            action: 'send',
            sendType: 'registration'
        }, "Received request to send message.");

        return sendMessage({registration}, MessageSendType.Registration, req.body, req.log, parseIOSFromPayload);
    })
    .then((finalId) => {
        res.json({
            id: finalId
        });
    })
    .catch((err) => {
        next(err);
    })
}