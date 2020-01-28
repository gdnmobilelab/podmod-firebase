"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require("pg");
const env_1 = require("./env");
// As mentioned here:
// https://github.com/brianc/node-pg-types
// node-pg doesn't automatically convert int8 to a JS integer. So let's set that up:
pg.types.setTypeParser(20, val => parseInt(val, 10));
let pool = undefined;
function setup() {
    return __awaiter(this, void 0, void 0, function* () {
        if (pool) {
            throw new Error("DB Pool is already set up");
        }
        pool = new pg.Pool({
            connectionString: env_1.default.DATABASE_URL
        });
        // check that we can connect
        const client = yield pool.connect();
        client.release();
    });
}
exports.setup = setup;
function shutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!pool) {
            throw new Error("DB is not set up");
        }
        yield pool.end();
        pool = undefined;
    });
}
exports.shutdown = shutdown;
function withDBClient(cb) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!pool) {
            throw new Error("DB is not set up");
        }
        const client = yield pool.connect();
        try {
            const result = cb(client);
            return result;
        }
        catch (err) {
            throw err;
        }
        finally {
            client.release();
        }
    });
}
exports.withDBClient = withDBClient;
//# sourceMappingURL=db.js.map