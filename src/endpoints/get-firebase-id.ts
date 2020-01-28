import { WebSubscription, iOSSubscription } from "../interface/subscription-types";
import { FCMError, FCMWebRegistrationResponse, FCMiOSBatchRegistrationResponse } from "../interface/fcm-responses";
import fetch from "node-fetch";
import { PushkinRequest, PushkinRequestHandler } from "../util/request-handler";
import Environment from "../util/env";
import { BadRequestError, InternalServerError } from "restify-errors";
import { validate } from "../validators/validate";
import { getAccessToken } from "../util/jwt";
import { getIdForiOSSubscription } from "../actions/get-ios-firebase-id";

// API documentation for this:
// https://developers.google.com/instance-id/reference/server#create_relationship_maps_for_app_instances

async function getIdForWebSubscription(sub: WebSubscription, req: PushkinRequest): Promise<string> {
  // Chrome has started sending an expirationTime key along with the rest of the subscription
  // and FCM throws an error if it's included. So let's filter to only the keys we know we need.

  let subscriptionToSend = {
    endpoint: sub.endpoint,
    keys: sub.keys
  };

  // check we have the right data types
  validate(subscriptionToSend, "WebSubscription");

  const { token } = await getAccessToken();

  let response = await fetch("https://iid.googleapis.com/v1/web/iid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      "Crypto-Key": "p256ecdsa=" + Environment.VAPID_PUBLIC_KEY
    },
    body: JSON.stringify(subscriptionToSend)
  });

  let json = (await response.json()) as FCMWebRegistrationResponse;

  if (json.error as FCMError) {
    throw new InternalServerError(json.error.message);
  }

  if (!json.token) {
    throw new InternalServerError("No error received, but no token is present either");
  }

  return json.token;
}

async function getIdForiOSSubscriptionEndpoint(sub: iOSSubscription, req: PushkinRequest): Promise<string> {
  validate(sub, "iOSSubscription");

  if (Environment.PERMITTED_IOS_BUNDLES) {
    let allBundles = Environment.PERMITTED_IOS_BUNDLES.split(",").map(s => s.trim());
    if (allBundles.indexOf(sub.bundle_name) === -1) {
      throw new BadRequestError("iOS bundle name is not in the list of permitted bundles.");
    }
  }

  return getIdForiOSSubscription(sub, req.log);
}

interface FirebaseIDRequestBody {
  subscription: iOSSubscription | WebSubscription;
  extra_info?: any;
}

export const getFirebaseId: PushkinRequestHandler<FirebaseIDRequestBody, void> = async function(req, res, next) {
  try {
    let firebaseID: string;
    if (!req.body || !req.body.subscription) {
      throw new BadRequestError("You must send a 'subscription' object with the client push info.");
    }

    if (req.body.extra_info) {
      // This is a place to add any user-specific information that we can pull out of the DB later.
      req.log.info({ extra_info: req.body.extra_info }, "Extra information was sent with the request");
    }

    if (!req.body.subscription.platform) {
      firebaseID = await getIdForWebSubscription(req.body.subscription as WebSubscription, req);
    } else if (req.body.subscription.platform === "iOS") {
      firebaseID = await getIdForiOSSubscriptionEndpoint(req.body.subscription as iOSSubscription, req);
    } else {
      throw new BadRequestError("Unrecognised notification platform.");
    }

    req.log.info(
      { firebaseID, subscription: req.body.subscription },
      "Successfully retreived Firebase ID for subscription."
    );

    res.json({
      id: firebaseID
    });
  } catch (err) {
    let target: "error" | "warn" = "error";
    if (err instanceof BadRequestError) {
      // We only log at the error level for problems caused internally in pushkin.
      // If it's a 400 error it means the user provided bad data, so we just warn.
      target = "warn";
    }

    req.log[target](
      {
        subscription: req.body ? req.body.subscription : undefined,
        error: err.message
      },
      "Failed to get Firebase ID for subscription."
    );

    next(err);
  }
};
