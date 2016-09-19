"use strict";
const bunyan = require('bunyan');
const pg = require('pg');
const stream = require('stream');
const client = new pg.Client(process.env.DATABASE_URL);
class DbStream extends stream.Writable {
    constructor() {
        super({ objectMode: true });
    }
    _write(data, encoding, cb) {
        let specificFields = ["name", "pid", "hostname", "time", "level", "msg", "req_id", "v"];
        let fieldData = [];
        specificFields.forEach((field) => {
            fieldData.push(data[field]);
            delete data[field];
        });
        // Manually add the data field, as we
        // didn't want to iterate over it earlier
        specificFields.push("data");
        fieldData.push(data);
        let query = "INSERT INTO log_entries (" +
            specificFields.join(",") +
            ") VALUES (" +
            specificFields.map((item, i) => "$" + (i + 1)).join(",")
            + ":: jsonb)";
        client.query(query, fieldData, (err, result) => {
            if (err) {
                console.error(err);
            }
            cb();
        });
    }
}
const log = bunyan.createLogger({
    name: "pushkin-firebase"
});
log.addStream({
    level: 'debug',
    stream: new DbStream(),
    type: 'raw'
});
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = log;
client.connect();
//# sourceMappingURL=log.js.map