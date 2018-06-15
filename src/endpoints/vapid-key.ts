import { PushkinRequestHandler } from "../util/request-handler";
import Environment from "../util/env";

function base64ToArrayBuffer(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = Buffer.from(base64, "base64").toString("binary");
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const getVAPIDKey: PushkinRequestHandler = async function(req, res, next) {
  try {
    let keyAsBuffer = base64ToArrayBuffer(Environment.VAPID_PUBLIC_KEY);
    res.contentType = "application/octet-stream";
    res.send(Buffer.from(keyAsBuffer.buffer));
    res.end();
  } catch (err) {
    next(err);
  }
};
