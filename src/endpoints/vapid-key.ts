import { PushkinRequestHandler } from "../util/request-handler";
import Environment from "../util/env";

export const getVAPIDKey: PushkinRequestHandler = async function(req, res, next) {
  try {
    let keyAsBuffer = new Buffer(Environment.VAPID_PUBLIC_KEY, "base64");
    res.contentType = "application/octet-stream";
    res.send(keyAsBuffer);
    res.end();
  } catch (err) {
    next(err);
  }
};
