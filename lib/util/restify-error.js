"use strict";
class RestifyError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.RestifyError = RestifyError;
//# sourceMappingURL=restify-error.js.map