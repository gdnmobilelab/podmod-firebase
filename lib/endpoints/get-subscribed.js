"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = require("node-fetch");
const namespace_topic_1 = require("../util/namespace-topic");
exports.getSubscribed = function (req, res, next) {
    let id = req.params["registration_id"];
    req.log.info({ id, action: "get-subscriptions" }, "Received request to get subscribed topics.");
    node_fetch_1.default(`https://iid.googleapis.com/iid/info/${id}?details=true`, {
        headers: {
            Authorization: `key=${process.env.FIREBASE_AUTH_KEY}`
        }
    })
        .then(res => res.json())
        .then((json) => {
        if (json.error) {
            req.log.error({ error: json.error, success: false }, "Request to get topics failed.");
            throw new Error(json.error);
        }
        req.log.info({ success: true }, "Successfully retreived subscription topics");
        let topics = [];
        if (json.rel && json.rel.topics) {
            // If there are no subscription this object just doesn't exist
            topics = Object.keys(json.rel.topics);
        }
        let unnamespaced = topics.map(namespace_topic_1.unnamespaceTopic);
        let inThisEnvironment = unnamespaced.filter(n => n.environment == process.env.NODE_ENV);
        res.json(inThisEnvironment.map(n => n.topicName));
    });
};
//# sourceMappingURL=get-subscribed.js.map