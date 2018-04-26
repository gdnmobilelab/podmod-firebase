"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCachingHeaders = function (req, res, next) {
    // we don't want to cache anything other than our CORS preflight requests
    if (req.method !== "OPTIONS") {
        res.setHeader("Cache-Control", "no-cache");
    }
    next();
};
//# sourceMappingURL=http-cache-headers.js.map