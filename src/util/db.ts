import * as pg from "pg";
import * as restify from "restify";
import {JWT} from 'google-auth-library';

export function createClient() {
  return new pg.Client(process.env.DATABASE_URL);
}

export interface DbEnabledRequest extends restify.Request {
  db: {
    client: pg.Client;
    query: (text: string, params: any[]) => Promise<any[]>;
  },
  jwt:JWT
}

export type DbEnabledRequestHandler = (req: DbEnabledRequest, res: restify.Response, next: restify.Next) => any;

export function addClientToRequest(client: pg.Client, jwt:JWT) {
  return function(req: DbEnabledRequest, res: restify.Response, next: restify.Next) {
    req.db = {
      client: client,
      query: (text, params) => {
        return new Promise((fulfill, reject) => {
          client.query(text, params, function(err, result) {
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
