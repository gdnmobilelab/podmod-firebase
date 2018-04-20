"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validators_1 = require("./validators");
const jsonschema_1 = require("jsonschema");
const validator = new jsonschema_1.Validator();
validator.addSchema(validators_1.default);
function validate(obj, definitionName, options) {
    return validator.validate(obj, validators_1.default.definitions[definitionName], options);
}
exports.validate = validate;
//# sourceMappingURL=validate.js.map