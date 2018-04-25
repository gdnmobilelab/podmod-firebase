# pushkin

## What is it?

A link between our site/apps and [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/). It's a service provided by Google that will send push messages to iOS, Android and the web Push API. It also handles things like topic subscriptions, so we don't have to send hundreds of pushes at once outselves, we just let Google handle it.

In normal situation Pushkin isn't necessary, you just add the Firebase dependencies to your site and apps and interface directly. But our setup is a little weird - for instance, we're passing native push tokens into webviews, so the barriers between native and web get a little fuzzy. Plus, we didn't want to add any dependencies to the apps. So Pushkin is our stand-in for local Firebase libraries.

## What it uses

* Node (currently v8.0)
* Postgres (needs a version that supports the JSONB data type)
* TypeScript
* Docker (both in production and locally)

## Where it runs

Pushkin runs on staging and production:

* `https://pushkin.stg.newsdev.nytimes.com/`
* `https://pushkin.newsdev.nytimes.com/`

However, staging can only be used with the debug versions of the apps. Read [this page on the wiki](https://github.com/newsdev/pushkin/wiki/App-and-server-environments) for more details.

## Using it

Refer to [the wiki](https://github.com/newsdev/pushkin/wiki) for further instructions on how to actually use Pushkin.

## Configuration

Pushkin requires a number of environment variables to be set in order to function correctly. Some can be found in the Firebase project configuration page, but others require you to set up a [service account](https://console.cloud.google.com/projectselector/iam-admin/serviceaccounts) and download the JSON file with the required auth fields. (NOTE: this service account must also be given editor permissions, otherwise it won't be able to send messages)

* `DATABASE_URL`: in the format of `postgres://user:password@host/database`.
* `FCM_PROJECT`: the Firebase project ID. `project_id` in the service account JSON file.
* `FIREBASE_AUTH_KEY`: the 'Server Key' listed in the Cloud Messaging configuration page of your Firebase project.
* `FIREBASE_CLIENT_EMAIL`: the `client_email` field in the service account JSON.
* `FIREBASE_PRIVATE_KEY`: the `private_key` field in the service account JSON. This and the client e-mail are used to create a JSON web token.
* `USER_API_KEY`: the key required in the Authorization header of user-level requests
* `ADMIN_API_KEY`: same as above, except for admin-level operations like sending messages
* `TOPIC_PREFIX`: in case we're using multiple instances of Pushkin with one Firebase account (we only have one for production, for example) all Firebase topics will be prefixed with this string. Unless you're doing something particularly strange this should be invisible within your Pushkin instance.
* `VAPID_PUBLIC_KEY`: used in web notifications. Right now it has to be hardcoded to FCM's key (see the [wiki](https://github.com/newsdev/pushkin/wiki/Getting-a-token) for details)
* `NODE_ENV`: a very common environment variable in node projects, is either `production`, `staging` or `development`. Is also used alongside `TOPIC_PREFIX` when interfacing with Firebase topics, to ensure we don't leak staging messages into production.

## Testing

To run tests locally you need to have Docker installed locally (primarily to spin up a test database). To run the tests once, just run

    npm run test

from the command line. It uses Mocha to run through the current tests and will highlight results. If you're actively developing and want to run tests automatically, run

    npm run test-watch

which will run all the tests, then watch for any file changes, running them again whenever it detects one. If you want to save time and avoid running every single test, use mocha's [`it.only`](https://jaketrent.com/post/run-single-mocha-test/#run-a-single-test) functionality to ensure only your current test runs.

## Running locally

Similar to testing, this uses `docker-compose` to set up a local database:

    npm run dev

However, you must also ensure that you have a `.env` file in your project directory that specifies various Firebase settings. We don't include this in the repo as it contains sensitive data, but `example.env` shows you the keys you need. For more information, see the 'configuration' section.

## Publishing a new build

In addition to the usual Google Cloud steps to deploy a Docker container, you need to make sure you run `npm run build` before building a Docker image - this step transpiles the TypeScript into JavaScript, allowing the production Docker container to ignore TypeScript entirely.

## Rebuilding validators

We validate incoming requests to ensure that they match the TypeScript interfaces we've defined. This is done by converting the TS interfaces into a JSON schema with [typescript-json-schema](https://github.com/YousefED/typescript-json-schema), but this isn't done automatically. When you change one of the request interfaces, run:

    npm run build-interface-validation

to overwrite the entry in `src/validation/validators.ts` (also, don't manually edit this file as any changes will get lost the next time it's run)
