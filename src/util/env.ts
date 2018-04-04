interface EnvironmentVariables {
  FIREBASE_AUTH_KEY: string;
  FIREBASE_SENDER_ID: string;
  DATABASE_URL: string;
  USER_API_KEY: string;
  ADMIN_API_KEY: string;
  NODE_ENV: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FCM_PROJECT: string;
}

export default (process.env as any) as EnvironmentVariables;
