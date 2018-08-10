import * as restify from "restify";
import { checkForKey, ApiKeyType } from "./security/key-check";
import { getFirebaseId } from "./endpoints/get-firebase-id";
import { getSubscribed } from "./endpoints/get-subscribed";
import { sendMessageToRegistration, sendMessageToTopic, sendMessageToCondition } from "./endpoints/send-message";
import { getTopicDetails, getTopicSubscribers } from "./endpoints/topic-details";
import { getVAPIDKey } from "./endpoints/vapid-key";
import { healthcheck } from "./endpoints/health-check";
import { subscribeOrUnsubscribe } from "./endpoints/subscribe";

export function setRoutes(server: restify.Server) {
  server.post("/registrations", checkForKey(ApiKeyType.User), getFirebaseId);
  server.get("/registrations/:registration_id/topics", checkForKey(ApiKeyType.User), getSubscribed);
  server.post("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);
  server.del("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);

  server.post("/topics/:topic_name", checkForKey(ApiKeyType.Admin), sendMessageToTopic);
  server.post("/send", checkForKey(ApiKeyType.Admin), sendMessageToCondition);

  server.post("/registrations/:registration_id", checkForKey(ApiKeyType.Admin), sendMessageToRegistration);
  server.get("/topics/:topic_name", checkForKey(ApiKeyType.Admin), getTopicDetails);
  server.get("/topics/:topic_name/subscribers", checkForKey(ApiKeyType.Admin), getTopicSubscribers);
  server.get("/vapid-key", checkForKey(ApiKeyType.User), getVAPIDKey);

  server.get("/healthcheck", healthcheck);
}
