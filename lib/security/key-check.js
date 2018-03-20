"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const restify_error_1 = require("../util/restify-error");
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
            next(new restify_error_1.RestifyError(401, "You must provide an API key in the Authorization field"));
        }
        if (keyType === ApiKeyType.User && auth === process.env.USER_API_KEY) {
            return next();
        }
        else if (keyType === ApiKeyType.Admin && auth === process.env.ADMIN_API_KEY) {
            return next();
        }
        else {
            req.log.warn({ url: req.url, auth }, "Attempt to access endpoint with incorrect API key.");
            next(new restify_error_1.RestifyError(403, "Incorrect API key for this operation."));
        }
    };
}
exports.checkForKey = checkForKey;
//# sourceMappingURL=key-check.js.map