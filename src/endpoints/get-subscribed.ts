import * as restify from 'restify';
import * as fetch from 'node-fetch';
import {unnamespaceTopic} from '../util/namespace-topic';

export const getSubscribed:restify.RequestHandler = function(req, res, next) {
    let id = req.params["registration_id"];

    req.log.info({id, action: "get-subscriptions"}, "Received request to get subscribed topics.");

    fetch(`https://iid.googleapis.com/iid/info/${id}?details=true`, {
        headers: {
            "Authorization": `key=${process.env.FIREBASE_AUTH_KEY}`
        }
    })
    .then((res) => res.json())
    .then((json) => {

        if (json.error) {
            req.log.error({error:json.error, success: false}, "Request to get topics failed.")
            throw new Error(json.error);
        }

        req.log.info({success: true}, "Successfully retreived subscription topics");

        let topics:string[] = [];

        if (json.rel && json.rel.topics) {
            // If there are no subscription this object just doesn't exist
            topics = Object.keys(json.rel.topics);
        }

        let unnamespaced = topics.map(unnamespaceTopic);

        let inThisEnvironment = unnamespaced.filter((n) => n.environment == process.env.NODE_ENV);

        res.json(inThisEnvironment.map((n) => n.topicName));
    })
}