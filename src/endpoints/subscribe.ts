import * as restify from 'restify';
import * as fetch from 'node-fetch';
import * as bunyan from 'bunyan';

function sendRequest(id:string, topicName:string, method:string, log:bunyan.Logger):Promise<boolean> {
    
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
        })
    })
    .then(() => {
        log.info({
            method: method
        }, "Successful request to Firebase.")
        return true;
    })
    .catch((err) => {
        log.error({
            method: method,
            error: err.message
        }, "Request to Firebase failed.");
        throw err;
    })
    
}

export const subscribeOrUnsubscribe:restify.RequestHandler = function(req, res, next) {

    let topicName:string = req.params["topic_name"];
    let id = req.params["registration_id"];

    let action = req.method == "POST" ? "subscribe" : "unsubscribe";

    req.log.info({action, topicName, id}, "Received request.");
    
    return sendRequest(id, topicName, req.method, req.log)
    .then(() => {
        res.json({
            subscribed: action === "subscribe"
        })
    })
    .catch((err) => {
        next(err);
    })
    
}