import * as pg from "pg";
import * as restify from "restify";
import { JWT } from "google-auth-library";

export interface PushkinRequest<B = any, P = any> extends restify.Request {
  // db: pg.Client;
  // jwt: JWT;
  body: B;
  params: P;
}

export type PushkinRequestHandler<B = any, P = any> = (
  req: PushkinRequest<B, P>,
  res: restify.Response,
  next: restify.Next
) => any;
