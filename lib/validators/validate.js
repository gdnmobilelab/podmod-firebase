"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validators_1 = require("./validators");
const jsonschema_1 = require("jsonschema");
const errors_1 = require("../util/errors");
// This uses the JSON schemas generated in `npm run build-interface-validation` to
// validate incoming request bodies. Primarily it allows us to check that the information
// we are passing directly on to Firebase is actually correct.
const validator = new jsonschema_1.Validator();
validator.addSchema(validators_1.default);
/**
 * @param  {any} obj the object we want to validate
 * @param  {ValidatorDefinition} definitionName the name of the interface we're checking against.
 */
function validate(obj, definitionName) {
    let validationResult = validator.validate(obj, validators_1.default.definitions[definitionName]);
    if (validationResult.errors.length > 0) {
        let err = new errors_1.ValidationFailedError("Object validation failed", validationResult.errors.map(e => e.stack));
        throw err;
    }
}
exports.validate = validate;
//# sourceMappingURL=validate.js.map