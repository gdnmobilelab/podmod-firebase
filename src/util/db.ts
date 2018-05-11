import * as pg from "pg";
import * as restify from "restify";
import { JWT } from "google-auth-library";
import { PushkinRequest, PushkinRequestHandler } from "./request-handler";
import Environment from "./env";

// As mentioned here:
// https://github.com/brianc/node-pg-types
// node-pg doesn't automatically convert int8 to a JS integer. So let's set that up:
pg.types.setTypeParser(20, val => parseInt(val, 10));

export function createClient() {
  return new pg.Client(Environment.DATABASE_URL);
}

export function addClientToRequest(client: pg.Client, jwt: JWT) {
  return function(req: PushkinRequest<any, any>, res: restify.Response, next: restify.Next) {
    req.db = client;
    req.jwt = jwt;
    next();
  };
}
