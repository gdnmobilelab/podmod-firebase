import * as restify from 'restify';
import {RestifyError} from '../util/restify-error';
import * as bunyan from 'bunyan';
import * as fetch from 'node-fetch';
import {namespaceTopic} from '../util/namespace-topic';

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

export function sendMessage(target:string, msgType: MessageSendType, body: MessageSendBody, log:bunyan.Logger):Promise<string> {
    
    let errors = checkForErrors(body, errorMessages);

    if (body.ios) {
        errors = errors.concat(checkForErrors(body.ios, iOSMessages));
    }

    if (errors.length > 0) {
        throw new RestifyError(400, errors.join(', '))
    }

    let iosAttachments:string = null;
    let iosActions:string = null;

    if (body.ios.attachments) {
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
            collapse_id: body.ios.collapse_id
        },
        notification: {
            title: body.ios.title,
            body: body.ios.body
        }
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
    })
}

export const sendMessageToTopic:restify.RequestHandler = function(req, res, next) {
    
    Promise.resolve()
    .then(() => {

        let topicName = namespaceTopic(req.params['topic_name']);

        req.log.info({
            target: topicName,
            action: 'send',
            sendType: 'topic'
        }, "Received request to send message.")

        return sendMessage(`/topics/${topicName}`, MessageSendType.Topic, req.body, req.log);
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

        let registration = req.params['registration_id'];

        req.log.info({
            target: registration,
            action: 'send',
            sendType: 'registration'
        }, "Received request to send message.")

        return sendMessage(registration, MessageSendType.Registration, req.body, req.log);
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