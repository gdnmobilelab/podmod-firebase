import * as stream from "stream";
import { DbStream } from "./db-stream";
import * as fetch from "node-fetch";

export class SlackWebhook extends stream.Writable {
  webhookURL: string;
  dbStream: DbStream;

  constructor(webhookURL: string, dbStream: DbStream) {
    super({ objectMode: true });
    this.dbStream = dbStream;
    this.webhookURL = webhookURL;
  }

  _write(obj: any, encoding: string, cb: Function) {
    // we don't want to get the current log message because we're not
    // sure if it's been logged yet (streams run in parallel). So we'll
    // just add it manually.

    this.dbStream.client.query(
      `
            SELECT
                jsonb_merge(data) as data,
                json_agg(msg) as msg,
                max(time) as t
            FROM
                log_entries
            WHERE
                req_id = $1
            AND NOT
                time = $2
            GROUP BY
                req_id
        `,
      [obj.req_id, obj.time],
      (err, result) => {
        let utc = obj.time.toUTCString();

        let msg: any[] = [];
        let data: any = {};

        if (result.rows[0]) {
          msg = result.rows[0].msg || msg;
          data = result.rows[0].data || data;
        }

        Object.assign(data, obj);
        msg.push(obj.msg);

        let attachmentFields: any[] = [];

        let ignoreFields = ["v", "name", "hostname", "pid", "msg", "time", "level"];

        let longFields = ["url"];

        for (let key in data) {
          if (ignoreFields.indexOf(key) > -1) {
            continue;
          }
          attachmentFields.push({
            title: key,
            value: data[key],
            short: longFields.indexOf(key) == -1
          });
        }

        let colors: any = {
          40: "warning",
          50: "danger"
        };

        let attachment = {
          color: colors[obj.level],
          fallback: msg[0],
          text: msg.join("\n"),
          fields: attachmentFields
        };

        let webhookMessage = {
          username: "Alexander Pushkin, Staging",
          icon_url: "https://www.gdnmobilelab.com/images/pushkin-stg.jpg",
          attachments: [attachment]
        };
        cb();
        return;
        // fetch(this.webhookURL, {
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     method: "POST",
        //     body: JSON.stringify(webhookMessage)
        // })
        // .then((res) => res.text())
        // .then((text) => {
        //     cb()
        // });
      }
    );
  }
}
