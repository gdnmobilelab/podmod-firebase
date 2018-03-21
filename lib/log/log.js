"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
const db_stream_1 = require("./db-stream");
const slack_webhook_1 = require("./slack-webhook");
function createLogger(client) {
    const log = bunyan.createLogger({
        name: "pushkin-firebase"
    });
    if (process.env.NODE_ENV === "test") {
        log.level(50);
    }
    else {
        let dbStream = new db_stream_1.DbStream(client);
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
    }
    return log;
}
exports.createLogger = createLogger;
//# sourceMappingURL=log.js.map