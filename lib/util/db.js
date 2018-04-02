"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require("pg");
function createClient() {
    return new pg.Client(process.env.DATABASE_URL);
}
exports.createClient = createClient;
function addClientToRequest(client) {
    return function (req, res, next) {
        req.db = {
            client: client,
            query: (text, params) => {
                return new Promise((fulfill, reject) => {
                    client.query(text, params, function (err, result) {
                        if (err) {
                            return reject(err);
                        }
                        fulfill(result.rows);
                    });
                });
            }
        };
        next();
    };
}
exports.addClientToRequest = addClientToRequest;
//# sourceMappingURL=db.js.map