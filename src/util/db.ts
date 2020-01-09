import * as pg from "pg";
import * as restify from "restify";
import { JWT } from "google-auth-library";
import { PushkinRequest, PushkinRequestHandler } from "./request-handler";
import Environment from "./env";

// As mentioned here:
// https://github.com/brianc/node-pg-types
// node-pg doesn't automatically convert int8 to a JS integer. So let's set that up:
pg.types.setTypeParser(20, val => parseInt(val, 10));

let pool: pg.Pool | undefined = undefined;

export async function setup() {
  pool = new pg.Pool({
    connectionString: Environment.DATABASE_URL
  });

  // check that we can connect
  const client = await pool.connect();
  client.release();
}

export async function shutdown() {
  if (!pool) {
    throw new Error("DB is not set up");
  }
  await pool.end();
}

export async function withDBClient<T>(cb: (client: pg.PoolClient) => T | Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error("DB is not set up");
  }
  const client = await pool.connect();
  try {
    const result = cb(client);
    return result;
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}

// export function createClient() {
//   return new pg.Client(Environment.DATABASE_URL);
// }

// export function addClientToRequest(client: pg.Client, jwt: JWT) {
//   return function(req: PushkinRequest<any, any>, res: restify.Response, next: restify.Next) {
//     req.db = client;
//     req.jwt = jwt;
//     next();
//   };
// }
