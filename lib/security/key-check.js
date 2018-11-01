"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const restify_errors_1 = require("restify-errors");
const env_1 = require("../util/env");
var ApiKeyType;
(function (ApiKeyType) {
    ApiKeyType["Admin"] = "admin";
    ApiKeyType["User"] = "user";
})(ApiKeyType = exports.ApiKeyType || (exports.ApiKeyType = {}));
function checkForKey(keyType, enforceRestriction = true) {
    if ((enforceRestriction && env_1.default.ALLOW_ADMIN_OPERATIONS === "false" && keyType === ApiKeyType.Admin) ||
        (enforceRestriction && env_1.default.ALLOW_USER_OPERATIONS === "false" && keyType === ApiKeyType.User)) {
        // This shuts off access to admin or user features entirely. The prime reason being so that
        // we can separate out instances between our adm and pub environments.
        //
        // We send a 404 because we want to consider this URL to simply not exist.
        return function (req, res, next) {
            req.log.warn({ url: req.url, environment: keyType }, "Attempt to access an endpoint in a disabled environment");
            next(new restify_errors_1.NotFoundError());
        };
    }
    // Slightly confusing, but this is a function that returns a function. That way we can specify
    // the level of authorisation we want when setting up routes, but have the actual authorisation
    // function run when the request is received.
    return function (req, res, next) {
        let auth = req.headers.authorization;
        if (!auth) {
            req.log.warn({ url: req.url }, "Attempt to access endpoint without specifying API key.");
            next(new restify_errors_1.ForbiddenError("You must provide an API key in the Authorization field"));
            return;
        }
        if (keyType === ApiKeyType.User && auth === env_1.default.USER_API_KEY) {
            return next();
        }
        else if (keyType === ApiKeyType.Admin && auth === env_1.default.ADMIN_API_KEY) {
            return next();
        }
        else {
            req.log.warn({ url: req.url, auth }, "Attempt to access endpoint with incorrect API key.");
            next(new restify_errors_1.ForbiddenError("Incorrect API key for this operation."));
        }
    };
}
exports.checkForKey = checkForKey;
//# sourceMappingURL=key-check.js.map