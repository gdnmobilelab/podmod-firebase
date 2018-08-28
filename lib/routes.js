"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const key_check_1 = require("./security/key-check");
const get_firebase_id_1 = require("./endpoints/get-firebase-id");
const get_subscribed_1 = require("./endpoints/get-subscribed");
const send_message_1 = require("./endpoints/send-message");
const topic_details_1 = require("./endpoints/topic-details");
const vapid_key_1 = require("./endpoints/vapid-key");
const health_check_1 = require("./endpoints/health-check");
const subscribe_1 = require("./endpoints/subscribe");
const bulk_subscribe_1 = require("./endpoints/bulk-subscribe");
function setRoutes(server) {
    server.post("/registrations", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_firebase_id_1.getFirebaseId);
    server.get("/registrations/:registration_id/topics", key_check_1.checkForKey(key_check_1.ApiKeyType.User), get_subscribed_1.getSubscribed);
    server.post("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
    server.del("/topics/:topic_name/subscribers/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
    server.post("/topics/:topic_name/subscribers", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), bulk_subscribe_1.bulkSubscribeOrUnsubscribe);
    server.del("/topics/:topic_name/subscribers", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), bulk_subscribe_1.bulkSubscribeOrUnsubscribe);
    server.post("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToTopic);
    server.post("/send", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToCondition);
    server.post("/registrations/:registration_id", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), send_message_1.sendMessageToRegistration);
    server.get("/topics/:topic_name", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), topic_details_1.getTopicDetails);
    server.get("/topics/:topic_name/subscribers", key_check_1.checkForKey(key_check_1.ApiKeyType.Admin), topic_details_1.getTopicSubscribers);
    server.get("/vapid-key", key_check_1.checkForKey(key_check_1.ApiKeyType.User), vapid_key_1.getVAPIDKey);
    server.get("/healthcheck", health_check_1.healthcheck);
}
exports.setRoutes = setRoutes;
//# sourceMappingURL=routes.js.map