import * as restify from "restify";
import { ForbiddenError } from "restify-errors";
import * as jwt from "jsonwebtoken";
import fetch from "node-fetch";
import Environment from "../util/env";
import { IAPVerifiedRequest } from "../interface/restify";

type IAPVerificationStatus = "ALLOWED" | "FORBIDDEN";
type JWTPayload = {
  header: {
    kid: string,
  },
  email: string,
  sub: string,
};
type Logger = (message: string) => void;
type SkipReason = "ip" | "envar" | "allowlist" | "nodeenv" | "allowed";

type GooglePublicKeyMap = { [key: string]: string };
let keys: GooglePublicKeyMap = {};

export async function verifyIAPHeader(req: IAPVerifiedRequest, res: restify.Response, next: restify.Next) {
  const shouldLog = !Environment.IAP_DISABLE_LOG && Environment.NODE_ENV !== 'development';
  const logger = req.log.info.bind(req.log) as Logger;

  if (!Environment.VERIFY_IAP) {
    return allowRequest('envar', req, next, shouldLog, logger);
  }

  const skippedEnvs = new Set(['development', 'test']);
  if (skippedEnvs.has(Environment.NODE_ENV)) {
    req.auth = {
      verifiedEmail: '',
    };
    return allowRequest('nodeenv', req, next, shouldLog, logger);
  }

  // IPv6 and IPv4 mapped loopback addresses; ::1, ::ffff:127.0.0.1, or matching /^\:\:ffff\:10\./
  if (
    req.connection.remoteAddress.match(/^::(1$|ffff:(10\.|127.0.0.1$))/) &&
    req.headers['x-forwarded-for'] === undefined
  ) {
    return allowRequest('ip', req, next, shouldLog, logger);
  }

  // Verify email
  const token = req.headers['x-goog-iap-jwt-assertion'] as string;
  const { header: { kid } } = jwt.decode(token, { complete: true }) as JWTPayload;

  try {
    const key = await getPublicKey(kid);
    const { email, sub } = jwt.verify(token, key) as JWTPayload; // sub stands for "subject"
    req.auth = req.auth || {};
    req.auth.requestedEmail = email;

    if (!isEmailAllowed(email)) {
      return next(new ForbiddenError('EMAIL NOT PERMITTED ACCESS. CONTACT APPLICATION OWNER.'));
    }

    req.auth.verifiedEmail = email;
    req.auth.verifiedSub = sub;
    allowRequest('allowed', req, next, shouldLog, logger);
  } catch (error) {
    logRequest(
      req,
      'FORBIDDEN',
      `FORBIDDEN: BAD JWT_TOKEN ${error.message} | DEBUG TOKEN: ${JSON.stringify(token)}`,
      logger
    );
    next(new ForbiddenError(`FORBIDDEN. ${error.message}`));
  }
}

function allowRequest(skipReason: SkipReason, request: restify.Request, next: restify.Next, shouldLog: Boolean, logger: Logger) {
  const skipHeaders: { [key in SkipReason]: string } = {
    ip: 'VERIFY_IAP IP',
    envar: 'VERIFY_IAP NOT ACTIVATED',
    allowlist: 'ROUTE ALLOWLIST',
    nodeenv: 'NODE_ENV DEV TEST',
    allowed: 'NO SKIP',
  };

  if (shouldLog) logRequest(request, 'ALLOWED', skipHeaders[skipReason], logger);
  return next();
}

function logRequest(request: IAPVerifiedRequest, status: IAPVerificationStatus, message: string, logger: Logger) {
  const { auth = {}, headers, connection, url } = request;
  const { remoteAddress } = connection;
  const { verifiedEmail, requestedEmail } = auth;
  const xForwardedFor = headers['x-forwarded-for'] || '';
  const email = verifiedEmail || requestedEmail || '';

  logger(
    `iap-verify: REQUEST ${status}: email [${email}], IP [${remoteAddress}], XFORWARDEDFOR [${xForwardedFor}], PATH [${url}], REASON [${message}]`
  );
}

async function getPublicKey(kid: string) {
  if (keys[kid]) return keys[kid];

  const response = await fetch('https://www.gstatic.com/iap/verify/public_key');
  keys = await response.json() as GooglePublicKeyMap;
  return keys[kid];
}

function isEmailAllowed(email: string): boolean {
  const allowedConfiguration = Environment.IAP_ALLOWLIST || '';
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