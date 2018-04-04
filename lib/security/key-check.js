"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const restify_errors_1 = require("restify-errors");
const env_1 = require("../util/env");
var ApiKeyType;
(function (ApiKeyType) {
    ApiKeyType[ApiKeyType["Admin"] = 0] = "Admin";
    ApiKeyType[ApiKeyType["User"] = 1] = "User";
})(ApiKeyType = exports.ApiKeyType || (exports.ApiKeyType = {}));
function checkForKey(keyType) {
    return (req, res, next) => {
        let auth = req.headers.authorization;
        if (!auth) {
            req.log.warn({ url: req.url }, "Attempt to access endpoint without specifying API key.");
            next(new restify_errors_1.ForbiddenError("You must provide an API key in the Authorization field"));
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