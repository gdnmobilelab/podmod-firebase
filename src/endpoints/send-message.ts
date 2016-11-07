import * as restify from 'restify';
import {RestifyError} from '../util/restify-error';
import * as bunyan from 'bunyan';
import * as fetch from 'node-fetch';
import {namespaceTopic} from '../util/namespace-topic';

const errorMessages:any = {
    'service_worker_url': "You must specify a service worker URL to receive the message (for iOS hybrid app)",
    'payload': "You must specify a payload to be sent to the remote device.",
    'ttl': "You must provide a time to live value.",
    'priority': "You must provide a priority of 'high' or 'normal'. Normal prioritises battery, high is faster."
}

export enum MessageSendType {
    Registration,
    Topic
}

export interface MessageSendBody {
    service_worker_url: string;
    payload: any;
    ttl: number;
    priority: 'high' | 'normal';

    // This is used by Firebase to replace push notifications that are still pending
    // Not required as it only allows up to 4 at a time.
    collapse_key?: string
}

export function sendMessage(target:string, msgType: MessageSendType, body: MessageSendBody, log:bunyan.Logger):Promise<string> {
    
    let errors:string[] = [];
        
    for (let key in errorMessages) {
        if (!(body as any)[key]) {
            errors.push(errorMessages[key]);
        }
    }

    if (errors.length > 0) {
        throw new RestifyError(400, errors.join(', '))
    }

    let sendBody = {
        to: target,
        collapse_key: body.collapse_key,
        // content_available: true,
        priority: body.priority,
        mutable_content: true,
        time_to_live: body.ttl,
        data: {
            send_time: Date.now(),
            service_worker_url: body.service_worker_url,
            payload: body.payload
        },
        notification: {
            title: "An update from Guardian Mobile Lab",
            body: "The contents of this notification should have been replaced. Please tell us about this!"
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