import migrate from "node-pg-migrate";
import { Client } from "pg";
import sinon from "sinon";
import * as GoogleAuth from "google-auth-library";
import { check as checkEnvironmentVariables } from "../src/util/env";
import nock from "nock";

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

  // By default nock lets any network traffic to domains not specifically mocked
  // pass through. Just to make sure nothing ever escapes our test environment,
  // we disable that. Then specifically allow connections to our local server.
  nock.disableNetConnect();
  nock.enableNetConnect("localhost:3000");

  // Then we stub out the JWT functionality, and have it return a dummy token
  // whenever this is called.
  jwt = sinon.stub(GoogleAuth, "JWT").returns({
    getAccessToken() {
      return Promise.resolve({ token: "TEST_TOKEN" });
    },
    authorize() {
      return Promise.resolve(true);
    }
  });

  if (globalStore.dbClient) {
    // If we're in watch mode then before() is run multiple times. If this
    // has already been run then we know the database is already set up and
    // ready, so we can skip these steps.

    return;
  }

  async function tryToConnect() {
    // just a little visual indicator to the user that we're actively working on something
    process.stdout.write(".");

    let client = new Client(process.env.DATABASE_URL);

    try {
      await client.connect();
      globalStore.dbClient = client;
    } catch (err) {
      if (err.routine && err.routine !== "ProcessStartupPacket") {
        // this is an actual Postgres error that we're not expecting.
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

  // Since we don't know the state of our test database, we ensure that it's migrated to the latest
  // schema.

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

  let tables = results.rows
    .map(r => r.table_name)
    // Don't want to empty out the migrations table!
    .filter(n => n !== "pgmigrations");

  for (let table of tables) {
    await globalStore.dbClient.query(`TRUNCATE TABLE ${table}`);
  }
});

after(() => {
  // get rid of the JWT web token. Really only need this because the next run in
  // watch mode would try to stub a stub otherwise.
  jwt.restore();

  // Also restore net connectivity - probably don't need this part.
  nock.cleanAll();
  nock.enableNetConnect();

  // If we're in watch mode we want to keep the db connection alive. If not,
  // it'll hang forever unless we kill it.

  if (process.argv.indexOf("--watch") > -1) {
    return;
  }

  globalStore.dbClient.end();
});
