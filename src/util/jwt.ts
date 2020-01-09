import { JWT } from "google-auth-library";
import Environment from "./env";

let jwt: JWT;

export async function setup() {
  // dotenv doesn't parse out newlines, so we need to do a manual replace
  const privateKey = Environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  jwt = new JWT(
    Environment.FIREBASE_CLIENT_EMAIL,
    null,
    privateKey,
    ["https://www.googleapis.com/auth/firebase.messaging", "https://www.googleapis.com/auth/cloud-platform"],
    null
  );

  await jwt.authorize();
}

export async function getAccessToken() {
  if (!jwt) {
    throw new Error("JWT token has not been set up");
  }
  return jwt.getAccessToken();
}
