import * as pg from "pg";
import * as stream from "stream";

export class DbStream extends stream.Writable {
  client: pg.PoolClient;
  activeQuery: boolean = false;
  finaliseCallback?: Function;

  constructor(client: pg.PoolClient) {
    super({ objectMode: true });
    this.client = client;
  }

  _final(cb: Function) {
    if (this.activeQuery === false) {
      return cb();
    }
    this.finaliseCallback = cb;
  }

  _write(dataOriginal: any, encoding: String, cb: Function) {
    let data = Object.assign({}, dataOriginal);

    let specificFields = ["name", "pid", "hostname", "time", "level", "msg", "req_id", "v"];
    let fieldData: any[] = [];

    specificFields.forEach(field => {
      // if (field === "time") {
      //     fieldData.push((data[field] as Date).getUTCDate())
      // } else {
      fieldData.push(data[field]);
      // }

      delete data[field];
    });

    // Manually add the data field, as we
    // didn't want to iterate over it earlier

    specificFields.push("data");
    fieldData.push(data);

    let query =
      "INSERT INTO log_entries (" +
      specificFields.join(",") +
      ") VALUES (" +
      specificFields.map((item, i) => "$" + (i + 1)).join(",") +
      ":: jsonb)";

    this.activeQuery = true;
    this.client.query(query, fieldData, (err, result) => {
      this.activeQuery = false;
      if (this.finaliseCallback) {
        this.finaliseCallback();
        this.finaliseCallback = null;
      }
      if (err) {
        console.error(err);
      }
      cb();
    });
  }
}
