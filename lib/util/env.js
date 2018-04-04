"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validators_1 = require("../validators/validators");
const jsonschema_1 = require("jsonschema");
function check() {
    jsonschema_1.validate(process.env, validators_1.default.definitions.EnvironmentVariables, { throwError: true });
}
exports.check = check;
exports.default = process.env;
//# sourceMappingURL=env.js.map