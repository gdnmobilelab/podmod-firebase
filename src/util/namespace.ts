import Environment from "./env";

// Since everything goes through the same Firebase account (it has to with the apps)
// we namespace our topics according to the environment Pushkin is currently working in.

// We use encodeURIComponent and = as separators to ensure that the regex won't ever get
// tripped up by the topic/prefix strings - = is always encoded.
const ENCODED_PREFIX = encodeURIComponent(Environment.TOPIC_PREFIX);
const ENCODED_ENV = encodeURIComponent(Environment.NODE_ENV);

export function namespaceTopic(topic: string) {
  let encodedTopic = encodeURIComponent(topic);

  return `=${ENCODED_PREFIX}=${ENCODED_ENV}=${encodedTopic}`;
}

const EXTRACT_REGEX = new RegExp(`^=${Environment.TOPIC_PREFIX}=(.+)=(.+)$`);

export function extractNamespacedTopic(namespacedTopic: string) {
  let regexResult = EXTRACT_REGEX.exec(namespacedTopic);

  if (!regexResult || !regexResult[2]) {
    throw new Error(
      `Could not extract topic from namespaced key ${namespacedTopic}` +
        ` (env: ${Environment.NODE_ENV}, prefix: ${Environment.TOPIC_PREFIX}`
    );
  }

  return {
    env: decodeURIComponent(regexResult[1]),
    topic: decodeURIComponent(regexResult[2])
  };
}
