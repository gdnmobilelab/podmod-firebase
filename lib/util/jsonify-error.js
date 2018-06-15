"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function JSONifyError(error) {
    let representation = {};
    Object.getOwnPropertyNames(error).forEach(function (key) {
        representation[key] = error[key];
    }, error);
    return representation;
}
exports.JSONifyError = JSONifyError;
//# sourceMappingURL=jsonify-error.js.map