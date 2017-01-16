"use strict";
const pg = require('pg');
exports.client = new pg.Client(process.env.DATABASE_URL);
function query(text, params) {
    return new Promise((fulfill, reject) => {
        exports.client.query(text, params, function (err, result) {
            if (err) {
                return reject(err);
            }
            fulfill(result.rows);
        });
    });
}
exports.query = query;
//# sourceMappingURL=db.js.map