"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
const db_stream_1 = require("./db-stream");
const env_1 = require("../util/env");
function createLogger(client) {
    const log = bunyan.createLogger({
        name: "pushkin-firebase"
    });
    if (env_1.default.NODE_ENV === "test") {
        log.level(50);
    }
    let dbStream = new db_stream_1.DbStream(client);
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
exports.createLogger = createLogger;
//# sourceMappingURL=log.js.map