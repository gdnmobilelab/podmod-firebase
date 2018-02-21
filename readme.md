# pushkin-firebase

A sequel of sorts to Pushkin:

https://github.com/gdnmobilelab/pushkin

We found that running our own notification architecture was a very time-consuming process and that sending HTTP requests for the Push API was very inconsistent (sometimes they'd take >30 seconds for reasons we could never discern). In the meantime since we'd created pushkin, Google added support for web notifications to [Google Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/), at no cost. So we figured it would be a much simpler solution. But it had two weaknesses:

* **Stats and logging**: it's surprisingly difficult to fetch the number of people currently subscribed to a topic on Firebase.
* **Client-side requirements**: the vanilla implementation of FCM requires you to include a relatively chunky JS library into your service worker. We wanted a simple HTTP endpoint system that mirrored Pushkin.
* **Confusing requirements for different environments**: we wanted separate staging and production environments and (at the time, at least) the means by which you'd achieve this in Firebase wasn't clear.
* **Standardisation across platforms**: Firebase requests to fetch a client ID are very different when comparing iOS and the web. Related to our work creating a [hybrid webview](https://github.com/gdnmobilelab/hybrid), we wanted to normalise that difference out as much as possible, to allow client-side code to be ignorant of what platform it was using.

### Enter pushkin-firebase

This library solves each of our problems:

* It uses a combination of [`bunyan`](https://www.npmjs.com/package/bunyan) and the JSONB data type in Postgres to create a queryable log system that will allow us to get the number of subscribers for any topic at any time. The design for that system is outlined in [this Medium post](https://medium.com/the-guardian-mobile-innovation-lab/structured-queryable-logging-with-postgres-and-bunyan-5169a2612859) and an example of its use can be found in `src/endpoints/get-count.ts`.
* The server exposes various HTTP endpoints (detailed below) but it does still require _some_ client-side code to save subscribed topics and so on - that is in the accompanying client library [pushkin-client](https://github.com/gdnmobilelab/pushkin-client).
* We define a `NODE_ENV` variable in our `.env` file (more on that below), and all topic operations are prefixed with that environment - so a call to subscribe to the topic `test_topic` is actually sent to Firebase as e.g. `staging__test_topic`, ensuring that we're keeping all operations separate.
* pushkin-firebase accepts the custom JSON payload created by our hybrid library to create new client IDs for both iOS and web clients in the same endpoint. However, our hybrid library has since been replaced by [SWWebView](https://github.com/gdnmobilelab/swwebview) so some work is required to sync up the two sides of this again.

## Requirements

* Node >= 6.0
* A Postgres database
* An active Firebase account with a project set up

The code is written in Typescript.

## Running pushkin-firebase

### Before running

Ensure you have all dependencies by running

    npm install

If you're in a production environment you can save some time and skip the development dependencies by running

    npm install --production

### Environment variables

You need to set a few environment variables in order to run pushkin-firebase successfully. When running in development mode, you can specify these environment variables in a `.env` file for simplicity (see `example.env` for... an example).

* `FIREBASE_AUTH_KEY`, `FIREBASE_SENDER_ID`: these should both be available in your Firebase account page.
* `DATABASE_URL`: we use Postgres for data storage. You don't need to preset a schema - pushkin does that itself - but you do need to create a database. URL should be in the format `postgresql://DB_USER:DB_PASSWORD@DB_HOST/DB_NAME`.
* `USER_API_KEY`: this is the key clients will use in order to perform user actions, e.g. subscribing/unsubscribing to a topic. It can be whatever you want.
* `ADMIN_API_KEY`: as above, except the key used to perform administrator level actions, like broadcasting a message to a topic.
* `SLACK_WEBHOOK`: this broadcasts any logging messages at the warning level or higher to the Slack webhook you specify. Useful for receiving alerts when something has gone wrong.
* `NODE_ENV`: the environment we're running in. As mentioned above, this is prefixed to all topic-specific actions.

### Actually running it

To run locally, in development mode, use:

    npm start

This will compile the Typescript code, run the server and pipe the output through Bunyan's CLI output formatter. To run in production mode instead, use:

    npm run production-start

This will _not_ compile the Typescript code (as it assumes it has already been compiled), but _will_ execute any pending database migrations before starting the server.

In either case, the server will start listening for requests on port 3000.

#### Running in Docker

An additional option is to run this in Docker - a `Dockerfile` is included in the repo to allow you to do just that. All you should need to do is set the appropriate environment variables.

## Future improvements

* tests(!!)
* Rewrite to switch promises to async/await, to make the code more readable.
