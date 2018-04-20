import { PushkinRequestHandler } from "../util/request-handler";
import Environment from "../util/env";

export const getVAPIDKey: PushkinRequestHandler = async function(req, res, next) {
  try {
    res.contentType = "application/octet-stream";
    res.send(Environment.VAPID_PUBLIC_KEY);
    res.end();
  } catch (err) {
    next(err);
  }
};
