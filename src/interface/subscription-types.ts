export interface iOSSubscription {
  device_id: string;
  bundle_name: string;
  sandbox: boolean;
  platform: "iOS";
}

export interface WebSubscription {
  endpoint: string;
  expirationTime?: any;
  keys: {
    p256dh: string;
    auth: string;
  };
  // This is never actually sent, but we're checking it to detect between the two
  // types here.
  platform?: undefined;
}
