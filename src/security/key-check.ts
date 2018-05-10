import * as restify from "restify";
import { ForbiddenError, NotFoundError } from "restify-errors";
import Environment from "../util/env";

export enum ApiKeyType {
  Admin,
  User
}

export function checkForKey(keyType: ApiKeyType): restify.RequestHandler {
  // Slightly confusing, but this is a function that returns a function. That way we can specify
  // the level of authorisation we want when setting up routes, but have the actual authorisation
  // function run when the request is received.

  return function(req, res, next) {
    if (
      (Environment.ALLOW_ADMIN_OPERATIONS === "false" && keyType === ApiKeyType.Admin) ||
      (Environment.ALLOW_USER_OPERATIONS === "false" && keyType === ApiKeyType.User)
    ) {
      // This shuts off access to admin or user features entirely. The prime reason being so that
      // we can separate out instances between our adm and pub environments.
      //
      // We send a 404 because we want to consider this URL to simply not exist.
      next(new NotFoundError());
      return;
    }

    let auth = req.headers.authorization;

    if (!auth) {
      req.log.warn({ url: req.url }, "Attempt to access endpoint without specifying API key.");
      next(new ForbiddenError("You must provide an API key in the Authorization field"));
      return;
    }

    if (keyType === ApiKeyType.User && auth === Environment.USER_API_KEY) {
      return next();
    } else if (keyType === ApiKeyType.Admin && auth === Environment.ADMIN_API_KEY) {
      return next();
    } else {
      req.log.warn({ url: req.url, auth }, "Attempt to access endpoint with incorrect API key.");
      next(new ForbiddenError("Incorrect API key for this operation."));
    }
  };
}
