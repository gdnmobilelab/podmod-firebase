"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const restify_errors_1 = require("restify-errors");
class ValidationFailedError extends restify_errors_1.BadRequestError {
    constructor(message, validationErrors) {
        super(message);
        this.validationErrors = validationErrors;
    }
    toJSON() {
        let base = super.toJSON();
        base.validation_errors = this.validationErrors;
        return base;
    }
}
exports.ValidationFailedError = ValidationFailedError;
//# sourceMappingURL=errors.js.map