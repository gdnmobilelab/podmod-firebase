import * as restify from 'restify';
import {subscribeOrUnsubscribe} from './endpoints/subscribe';
import {getFirebaseId} from './endpoints/get-firebase-id';
import {getSubscribed} from './endpoints/get-subscribed';
import {sendMessageToTopic, sendMessageToRegistration} from './endpoints/send-message';
import log from './log/log';
import {RestifyError} from './util/restify-error';

const server = restify.createServer({
    log: log
});

enum ApiKeyType {
    Admin,
    User
}

function checkForKey(keyType:ApiKeyType):restify.RequestHandler {
    return (req, res, next) => {
        
        let auth = req.headers.authorization;

        if (!auth) {
            req.log.warn({url: req.url}, "Attempt to access endpoint without specifying API key.")
            next(new RestifyError(401, "You must provide an API key in the Authorization field"));
        }
        
        if (keyType === ApiKeyType.User && auth === process.env.USER_API_KEY) {
            return next();
        } else if (keyType === ApiKeyType.Admin && auth === process.env.ADMIN_API_KEY) {
            return next();
        } else {
            req.log.warn({url: req.url, auth}, "Attempt to access endpoint with incorrect API key.")
            next(new RestifyError(403,"Incorrect API key for this operation."));
        }
    }
}

server.use(restify.bodyParser());
server.use(restify.requestLogger());

server.use(restify.CORS({
    headers: ['authorization']
}));

server.opts(/\.*/, function (req, res, next) {
    // for CORS
    let requestedHeaders = req.header("Access-Control-Request-Headers");
    res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE");
	res.send(200);
	next();
});

server.post("/registrations", checkForKey(ApiKeyType.User), getFirebaseId);
server.get("/registrations/:registration_id/topics", checkForKey(ApiKeyType.User), getSubscribed);
server.post("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);
server.del("/topics/:topic_name/subscribers/:registration_id", checkForKey(ApiKeyType.User), subscribeOrUnsubscribe);

server.post("/topics/:topic_name", checkForKey(ApiKeyType.Admin), sendMessageToTopic);
server.post("/registrations/:registration_id", checkForKey(ApiKeyType.Admin), sendMessageToRegistration);

server.listen(3000, function() {
    log.warn({action:"server-start", port: 3000, env: process.env.NODE_ENV}, "Server started.")
})