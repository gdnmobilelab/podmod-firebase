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
const env_1 = require("../util/env");
function base64ToArrayBuffer(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = Buffer.from(base64, "base64").toString("binary");
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
exports.getVAPIDKey = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let keyAsBuffer = base64ToArrayBuffer(env_1.default.VAPID_PUBLIC_KEY);
            res.contentType = "application/octet-stream";
            res.send(Buffer.from(keyAsBuffer.buffer));
            res.end();
        }
        catch (err) {
            next(err);
        }
    });
};
//# sourceMappingURL=vapid-key.js.map