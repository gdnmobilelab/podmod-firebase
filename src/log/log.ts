import * as bunyan from "bunyan";
import * as pg from "pg";
import * as stream from "stream";
import { DbStream } from "./db-stream";
import { SlackWebhook } from "./slack-webhook";
import Environment from "../util/env";

export function createLogger(client: pg.Client) {
  const log = bunyan.createLogger({
    name: "pushkin-firebase"
  });

  if (Environment.NODE_ENV === "test") {
    log.level(50);
  }
  let dbStream = new DbStream(client);

  log.addStream({
    level: "debug",
    stream: dbStream,
    type: "raw"
  });

  // if (Environment.SLACK_WEBHOOK) {
  //   log.addStream({
  //     level: "warn",
  //     stream: new SlackWebhook(Environment.SLACK_WEBHOOK, dbStream),
  //     type: "raw"
  //   });
  // }

  return { log, dbStream };
}
