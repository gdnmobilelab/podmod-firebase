import * as restify from "restify";
export const applyCachingHeaders: restify.RequestHandler = function(req, res, next) {
  // we don't want to cache anything other than our CORS preflight requests
  if (req.method !== "OPTIONS") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  next();
};
