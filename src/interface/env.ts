// This is really dumb, but we use strict validation, which means any extra keys
// we don't know about throw errors. Since process.env has all sorts of crap in it,
// we allow any other keys explicitly:

/**
 * @TJS-additionalProperties true
 */
export interface EnvironmentVariables {
  FIREBASE_AUTH_KEY: string;
  DATABASE_URL: string;
  USER_API_KEY: string;
  ADMIN_API_KEY: string;
  NODE_ENV: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FCM_PROJECT: string;
  ALLOWED_ORIGINS?: string;
  SERVER_PORT?: string;
  TOPIC_PREFIX: string;
  VAPID_PUBLIC_KEY: string;
  PERMITTED_IOS_BUNDLES?: string;
}
