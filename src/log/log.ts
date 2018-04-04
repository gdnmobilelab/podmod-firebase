import * as bunyan from "bunyan";
import * as pg from "pg";
import * as stream from "stream";
import { DbStream } from "./db-stream";
import { SlackWebhook } from "./slack-webhook";

export function createLogger(client: pg.Client) {
  const log = bunyan.createLogger({
    name: "pushkin-firebase"
  });

  if (process.env.NODE_ENV === "test") {
    log.level(50);
  }
  let dbStream = new DbStream(client);

  log.addStream({
    level: "debug",
    stream: dbStream,
    type: "raw"
  });

  // if (process.env.SLACK_WEBHOOK) {
  //   log.addStream({
  //     level: "warn",
  //     stream: new SlackWebhook(process.env.SLACK_WEBHOOK, dbStream),
  //     type: "raw"
  //   });
  // }

  return { log, dbStream };
}
