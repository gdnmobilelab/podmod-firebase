"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require("pg");
const env_1 = require("./env");
// As mentioned here:
// https://github.com/brianc/node-pg-types
// node-pg doesn't automatically convert int8 to a JS integer. So let's set that up:
pg.types.setTypeParser(20, val => parseInt(val, 10));
function createClient() {
    return new pg.Client(env_1.default.DATABASE_URL);
}
exports.createClient = createClient;
function addClientToRequest(client, jwt) {
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
        req.jwt = jwt;
        next();
    };
}
exports.addClientToRequest = addClientToRequest;
//# sourceMappingURL=db.js.map