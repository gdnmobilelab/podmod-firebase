import * as restify from "restify";
import { ForbiddenError } from "restify-errors";
// import { RestifyError } from "../util/restify-error";

export enum ApiKeyType {
  Admin,
  User
}

export function checkForKey(keyType: ApiKeyType): restify.RequestHandler {
  return (req, res, next) => {
    let auth = req.headers.authorization;

    if (!auth) {
      req.log.warn({ url: req.url }, "Attempt to access endpoint without specifying API key.");
      next(new ForbiddenError("You must provide an API key in the Authorization field"));
    }

    if (keyType === ApiKeyType.User && auth === process.env.USER_API_KEY) {
      return next();
    } else if (keyType === ApiKeyType.Admin && auth === process.env.ADMIN_API_KEY) {
      return next();
    } else {
      req.log.warn({ url: req.url, auth }, "Attempt to access endpoint with incorrect API key.");
      next(new ForbiddenError("Incorrect API key for this operation."));
    }
  };
}
