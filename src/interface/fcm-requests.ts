// https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#Message

interface FCMNotification {
  title: string;
  body: string;
}

interface FCMAndroidNotification {
  title?: string;
  body?: string;
  icon?: string; // must be internal resource
  color?: string; // must be in hex format
  sound?: string;
  tag?: string;
  click_action?: string;
}

interface FCMAndroidConfig {
  collapse_key?: string;
  priority: "normal" | "high"; // normal by default
  ttl?: string; // 4 weeks by default
  restricted_package_name?: string;
  data?: any;
  notification?: FCMAndroidNotification;
}

interface FCMWebpushNotification {
  title?: any;
  body?: any;
  icon?: any;
  badge?: any;
  tag?: any;
  image?: any;
  data?: { [key: string]: any };
  events?: any;
}

interface FCMWebpushConfig {
  headers?: { [key: string]: string };
  data?: { [key: string]: any };
  notification?: FCMWebpushNotification;
}

interface ApnsAlert {
  title?: string;
  body?: string;
  "launch-image"?: string;
}

interface ApnsKeys {
  alert?: ApnsAlert;
  badge?: number;
  sound?: string;
  "content-available"?: 1;
  category?: string;
  "thread-id"?: string;
  "mutable-content"?: 1;
}

interface ApnsPayload {
  aps?: ApnsKeys;
  [others: string]: any;
}

interface FCMApnsConfig {
  headers?: { [key: string]: string };
  payload?: ApnsPayload;
}

export interface FCMMessage {
  data?: any;
  notification: FCMNotification;
  android?: FCMAndroidConfig;
  webpush?: FCMWebpushConfig;
  apns?: FCMApnsConfig;
}

export interface FCMTopicMessage extends FCMMessage {
  topic: string;
}

export interface FCMTokenMessage extends FCMMessage {
  token: string;
}

export interface FCMConditionMessage extends FCMMessage {
  condition: string;
}

// https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send
export interface MessageSendRequest {
  message: FCMMessage;
  validate_only: boolean;
}
