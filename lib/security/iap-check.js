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
const restify_errors_1 = require("restify-errors");
const jwt = require("jsonwebtoken");
const node_fetch_1 = require("node-fetch");
const env_1 = require("../util/env");
let keys = {};
function verifyIAPHeader(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const shouldLog = !env_1.default.IAP_DISABLE_LOG && env_1.default.NODE_ENV !== 'development';
        const logger = req.log.info.bind(req.log);
        if (!env_1.default.VERIFY_IAP) {
            return allowRequest('envar', req, next, shouldLog, logger);
        }
        const skippedEnvs = new Set(['development', 'test']);
        if (skippedEnvs.has(env_1.default.NODE_ENV)) {
            req.auth = {
                verifiedEmail: '',
            };
            return allowRequest('nodeenv', req, next, shouldLog, logger);
        }
        // IPv6 and IPv4 mapped loopback addresses; ::1, ::ffff:127.0.0.1, or matching /^\:\:ffff\:10\./
        if (req.connection.remoteAddress.match(/^::(1$|ffff:(10\.|127.0.0.1$))/) &&
            req.headers['x-forwarded-for'] === undefined) {
            return allowRequest('ip', req, next, shouldLog, logger);
        }
        // Verify email
        const token = req.headers['x-goog-iap-jwt-assertion'];
        const { header: { kid } } = jwt.decode(token, { complete: true });
        try {
            const key = yield getPublicKey(kid);
            const { email, sub } = jwt.verify(token, key); // sub stands for "subject"
            req.auth = req.auth || {};
            req.auth.requestedEmail = email;
            if (!isEmailAllowed(email)) {
                return next(new restify_errors_1.ForbiddenError('EMAIL NOT PERMITTED ACCESS. CONTACT APPLICATION OWNER.'));
            }
            req.auth.verifiedEmail = email;
            req.auth.verifiedSub = sub;
            allowRequest('allowed', req, next, shouldLog, logger);
        }
        catch (error) {
            logRequest(req, 'FORBIDDEN', `FORBIDDEN: BAD JWT_TOKEN ${error.message} | DEBUG TOKEN: ${JSON.stringify(token)}`, logger);
            next(new restify_errors_1.ForbiddenError(`FORBIDDEN. ${error.message}`));
        }
    });
}
exports.verifyIAPHeader = verifyIAPHeader;
function allowRequest(skipReason, request, next, shouldLog, logger) {
    const skipHeaders = {
        ip: 'VERIFY_IAP IP',
        envar: 'VERIFY_IAP NOT ACTIVATED',
        allowlist: 'ROUTE ALLOWLIST',
        nodeenv: 'NODE_ENV DEV TEST',
        allowed: 'NO SKIP',
    };
    if (shouldLog)
        logRequest(request, 'ALLOWED', skipHeaders[skipReason], logger);
    return next();
}
function logRequest(request, status, message, logger) {
    const { auth = {}, headers, connection, url } = request;
    const { remoteAddress } = connection;
    const { verifiedEmail, requestedEmail } = auth;
    const xForwardedFor = headers['x-forwarded-for'] || '';
    const email = verifiedEmail || requestedEmail || '';
    logger(`iap-verify: REQUEST ${status}: email [${email}], IP [${remoteAddress}], XFORWARDEDFOR [${xForwardedFor}], PATH [${url}], REASON [${message}]`);
}
function getPublicKey(kid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (keys[kid])
            return keys[kid];
        const response = yield node_fetch_1.default('https://www.gstatic.com/iap/verify/public_key');
        keys = (yield response.json());
        return keys[kid];
    });
}
function isEmailAllowed(email) {
    const allowedConfiguration = env_1.default.IAP_ALLOWLIST || '';
    const allowlist = allowedConfiguration
        .split(',')
        .map((itm) => itm.trim());
    const domainAllowlist = allowlist.filter((itm) => {
        return itm[0] === '@';
    });
    const emailAllowlist = allowlist.filter((itm) => {
        return itm[0] !== '@';
    });
    const domain = '@' + email.split('@')[1];
    return !!domainAllowlist.find(allowed => allowed === domain) || !!emailAllowlist.find(allowed => allowed === email);
}
//# sourceMappingURL=iap-check.js.map