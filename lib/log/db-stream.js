"use strict";
const stream = require('stream');
class DbStream extends stream.Writable {
    constructor(client) {
        super({ objectMode: true });
        this.client = client;
    }
    _write(dataOriginal, encoding, cb) {
        let data = Object.assign({}, dataOriginal);
        let specificFields = ["name", "pid", "hostname", "time", "level", "msg", "req_id", "v"];
        let fieldData = [];
        specificFields.forEach((field) => {
            // if (field === "time") {
            //     fieldData.push((data[field] as Date).getUTCDate())
            // } else {
            fieldData.push(data[field]);
            // }
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
        this.client.query(query, fieldData, (err, result) => {
            if (err) {
                console.error(err);
            }
            cb();
        });
    }
}
exports.DbStream = DbStream;
//# sourceMappingURL=db-stream.js.map