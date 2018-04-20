import { Writable } from "stream";
import migrate from "node-pg-migrate";
import { Client } from "pg";
import * as ChildProcess from "child_process";
import * as sinon from "sinon";
import * as GoogleAuth from "google-auth-library";
import { check as checkEnvironmentVariables } from "../src/util/env";
import * as nock from "nock";

require("dotenv").config({ path: __dirname + "/test.env" });

// Not 100% sure what Mocha does here but variables declared in this file are
// wiped out. So instead we store our persistent variables in global.
let globalStore: {
  dbClient: Client;
} = global as any;

// The server auths the web token when it's created, so we need to stub that
// before any other activity takes place, which we do in before()
let jwt: sinon.SinonStub;

before(async function() {
  checkEnvironmentVariables();

  nock.disableNetConnect();
  nock.enableNetConnect("localhost:3000");

  jwt = sinon.stub(GoogleAuth, "JWT").returns({
    getAccessToken() {
      return Promise.resolve({ token: "TEST_TOKEN" });
    },
    authorize() {
      return Promise.resolve(true);
    }
  });

  if (globalStore.dbClient) {
    return;
  }

  async function tryToConnect() {
    process.stdout.write(".");

    let client = new Client(process.env.DATABASE_URL);

    try {
      await client.connect();
      globalStore.dbClient = client;
    } catch (err) {
      if (err.routine && err.routine !== "ProcessStartupPacket") {
        // this is an actual Postgres error that we're not expecting.
        console.log(err);
        throw err;
      }

      // If we can't connect we wait, then run this function again, chaining
      // the async promises together

      await new Promise(fulfill => {
        setTimeout(fulfill, 300);
      });

      await tryToConnect();
    }
  }

  process.stdout.write("\nWaiting for database to be ready (may take some time if this is the first run).");

  await tryToConnect();
  process.stdout.write("\nRunning database migrations...");
  await migrate({
    databaseUrl: process.env.DATABASE_URL,
    migrationsTable: "pgmigrations",
    dir: "migrations",
    direction: "up",
    count: 999,
    ignorePattern: "",
    log: () => {}
  });
  process.stdout.write("\nRunning tests...\n\n");
});

beforeEach(async () => {
  // We need to clear out the database before every test we run. Best way
  // I could find to do that is this:

  let results = await globalStore.dbClient.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE';
  `);

  // Don't want to empty out the migrations table!
  let tables = results.rows.filter(r => r.table_name !== "pgmigrations").map(r => r.table_name);

  for (let table of tables) {
    await globalStore.dbClient.query(`TRUNCATE TABLE ${table}`);
  }
});

afterEach(async () => {});

after(() => {
  jwt.restore();

  nock.cleanAll();
  nock.enableNetConnect();

  // If we're in watch mode we want to keep the db connection alive. If not,
  // it'll hang forever unless we kill them.

  if (process.argv.indexOf("--watch") == -1) {
    globalStore.dbClient.end();
  }
});
