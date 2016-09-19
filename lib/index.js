"use strict";
const restify = require('restify');
const subscribe_1 = require('./endpoints/subscribe');
const get_firebase_id_1 = require('./endpoints/get-firebase-id');
const get_subscribed_1 = require('./endpoints/get-subscribed');
const send_message_1 = require('./endpoints/send-message');
const log_1 = require('./log/log');
const restify_error_1 = require('./util/restify-error');
const server = restify.createServer({
    log: log_1.default
});
var ApiKeyType;
(function (ApiKeyType) {
    ApiKeyType[ApiKeyType["Admin"] = 0] = "Admin";
    ApiKeyType[ApiKeyType["User"] = 1] = "User";
})(ApiKeyType || (ApiKeyType = {}));
function checkForKey(keyType) {
    return (req, res, next) => {
        let auth = req.headers.authorization;
        if (!auth) {
            req.log.warn({ url: req.url }, "Attempt to access endpoint without specifying API key.");
            next(new restify_error_1.RestifyError(401, "You must provide an API key in the Authorization field"));
        }
        if (keyType === ApiKeyType.User && auth === process.env.USER_API_KEY) {
            return next();
        }
        else if (keyType === ApiKeyType.Admin && auth === process.env.ADMIN_API_KEY) {
            return next();
        }
        else {
            req.log.warn({ url: req.url, auth: auth }, "Attempt to access endpoint with incorrect API key.");
            next(new restify_error_1.RestifyError(403, "Incorrect API key for this operation."));
        }
    };
}
server.use(restify.bodyParser());
server.use(restify.requestLogger());
server.post("/registrations", checkForKey(ApiKeyType.User), get_firebase_id_1.getFirebaseId);
server.get("/registrations/:registration_id/topics", checkForKey(ApiKeyType.User), get_subscribed_1.getSubscribed);
server.post("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
server.del("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribe_1.subscribeOrUnsubscribe);
server.post("/topics/:topic_name", checkForKey(ApiKeyType.Admin), send_message_1.sendMessageToTopic);
server.post("/registrations/:registraion_id", checkForKey(ApiKeyType.Admin), send_message_1.sendMessageToRegistration);
server.listen(3000, function () {
    log_1.default.warn({ action: "server-start", port: 3000 }, "Server started.");
});
//# sourceMappingURL=index.js.map