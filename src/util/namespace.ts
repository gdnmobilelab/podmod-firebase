import Environment, { check } from "./env";

// Since everything goes through the same Firebase account (it has to with the apps)
// we namespace our topics according to the environment Pushkin is currently working in.

function checkForSeparator(str: string) {
  if (str.indexOf("__") > -1) {
    throw new Error("String cannot contain two underscores next to each other");
  }
}

checkForSeparator(Environment.TOPIC_PREFIX);
checkForSeparator(Environment.NODE_ENV);

export function namespaceTopic(topic: string) {
  checkForSeparator(topic);

  return `__${Environment.TOPIC_PREFIX}__${Environment.NODE_ENV}__${topic}`;
}

const EXTRACT_REGEX = new RegExp(`^__${Environment.TOPIC_PREFIX}__(.+)__(.+)$`);

export function extractNamespacedTopic(namespacedTopic: string) {
  let regexResult = EXTRACT_REGEX.exec(namespacedTopic);

  if (!regexResult || !regexResult[2]) {
    throw new Error(
      `Could not extract topic from namespaced key ${namespacedTopic}` +
        ` (env: ${Environment.NODE_ENV}, prefix: ${Environment.TOPIC_PREFIX}`
    );
  }

  return {
    env: regexResult[1],
    topic: regexResult[2]
  };
}
