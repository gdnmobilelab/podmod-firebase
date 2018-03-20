"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
const db_stream_1 = require("./db-stream");
const slack_webhook_1 = require("./slack-webhook");
const db_1 = require("../util/db");
const log = bunyan.createLogger({
    name: "pushkin-firebase"
});
let dbStream = new db_stream_1.DbStream(db_1.client);
log.addStream({
    level: "debug",
    stream: dbStream,
    type: "raw"
});
if (process.env.SLACK_WEBHOOK) {
    log.addStream({
        level: "warn",
        stream: new slack_webhook_1.SlackWebhook(process.env.SLACK_WEBHOOK, dbStream),
        type: "raw"
    });
}
exports.default = log;
//# sourceMappingURL=log.js.map