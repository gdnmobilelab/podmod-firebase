import { PushkinRequest, PushkinRequestHandler } from "../util/request-handler";
import { withDBClient } from "../util/db";

export const healthcheck: PushkinRequestHandler = async function(req, res, next) {
  try {
    await withDBClient(async client => {
      let result = await client.query("SELECT 'pong' as ping", []);
      if (result.rows[0].ping !== "pong") {
        throw new Error("Database did not return expected result");
      }
    });

    res.end("OK");
  } catch (err) {
    res.status(500);
    res.end(err.message);
  }
};
