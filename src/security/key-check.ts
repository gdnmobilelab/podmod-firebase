import * as restify from "restify";
import { RestifyError } from "../util/restify-error";

export enum ApiKeyType {
  Admin,
  User
}

export function checkForKey(keyType: ApiKeyType): restify.RequestHandler {
  return (req, res, next) => {
    let auth = req.headers.authorization;

    if (!auth) {
      req.log.warn({ url: req.url }, "Attempt to access endpoint without specifying API key.");
      next(new RestifyError(401, "You must provide an API key in the Authorization field"));
    }

    if (keyType === ApiKeyType.User && auth === process.env.USER_API_KEY) {
      return next();
    } else if (keyType === ApiKeyType.Admin && auth === process.env.ADMIN_API_KEY) {
      return next();
    } else {
      req.log.warn({ url: req.url, auth }, "Attempt to access endpoint with incorrect API key.");
      next(new RestifyError(403, "Incorrect API key for this operation."));
    }
  };
}