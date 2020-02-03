"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("./env");
let jwt;
function setup() {
    return __awaiter(this, void 0, void 0, function* () {
        // dotenv doesn't parse out newlines, so we need to do a manual replace
        const privateKey = env_1.default.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
        jwt = new google_auth_library_1.JWT(env_1.default.FIREBASE_CLIENT_EMAIL, null, privateKey, ["https://www.googleapis.com/auth/firebase.messaging", "https://www.googleapis.com/auth/cloud-platform"], null);
        yield jwt.authorize();
    });
}
exports.setup = setup;
function getAccessToken() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!jwt) {
            throw new Error("JWT token has not been set up");
        }
        return jwt.getAccessToken();
    });
}
exports.getAccessToken = getAccessToken;
//# sourceMappingURL=jwt.js.map