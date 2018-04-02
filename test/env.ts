import { Writable } from "stream";
import * as Docker from "dockerode";
import migrate from "node-pg-migrate";
import { Client } from "pg";
import * as nodeCleanup from "node-cleanup";

require("dotenv").config({ path: __dirname + "/test.env" });
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

let dockerInstanceStream: Writable | null = null;

function closeDockerInstance() {
  if (!dockerInstanceStream) return;
  process.stdout.write("\nShutting down database container...\n");

  // sends ctrl-c to the container. Only reliable way I could find to shut down
  // the container before a sync function exits.
  dockerInstanceStream.write("\x03");
  dockerInstanceStream.end();
  dockerInstanceStream = null;
}

before(async function() {
  this.timeout(10000);

  process.stdout.write("\nCreating database container...");

  await new Promise((fulfill, reject) => {
    docker.pull("kiasaki/alpine-postgres:9.5", (err, stream) => {
      if (err) {
        reject(err);
      }
      stream.pipe(process.stdout);
      stream.on("end", fulfill);
    });
  });

  await docker.pull("kiasaki/alpine-postgres:9.5", {});

  let container = await docker.createContainer({
    Labels: {
      id: "pushkin-firebase-tests"
    },
    Image: "kiasaki/alpine-postgres:9.5",
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin: true,
    StdinOnce: true,
    Tty: true,
    HostConfig: {
      PortBindings: {
        "5432/tcp": [{ HostPort: "54322" }]
      }
    }
  });

  await container.start();

  // as any because Dockerode types assume it's a readable stream, when this one is writable
  dockerInstanceStream = (await container.attach({ stream: true, stdin: true })) as any;

  // This is primarily for watch mode - when we hit ctrl-c, we still shut down the container
  nodeCleanup(closeDockerInstance);

  async function tryToConnect() {
    process.stdout.write(".");
    if (!dockerInstanceStream) {
      return;
    }
    let client = new Client(process.env.DATABASE_URL);

    try {
      await client.connect();
      process.stdout.write("\n\n");
      await client.end();
    } catch (err) {
      // If we can't connect we wait, then run this function again, chaining
      // the async promises together

      await new Promise(fulfill => {
        setTimeout(fulfill, 300);
      });

      await tryToConnect();
    }
  }

  process.stdout.write("\nConnecting to database.");

  return tryToConnect();
});

after(closeDockerInstance);
