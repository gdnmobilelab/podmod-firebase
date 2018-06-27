"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./env");
// Since everything goes through the same Firebase account (it has to with the apps)
// we namespace our topics according to the environment Pushkin is currently working in.
function checkForSeparator(str) {
    if (str.indexOf("__") > -1) {
        throw new Error("String cannot contain two underscores next to each other");
    }
}
function namespaceTopic(topic) {
    checkForSeparator(env_1.default.TOPIC_PREFIX);
    checkForSeparator(env_1.default.NODE_ENV);
    checkForSeparator(topic);
    return `__${env_1.default.TOPIC_PREFIX}__${env_1.default.NODE_ENV}__${topic}`;
}
exports.namespaceTopic = namespaceTopic;
const EXTRACT_REGEX = new RegExp(`^__${env_1.default.TOPIC_PREFIX}__(.+)__(.+)$`);
function extractNamespacedTopic(namespacedTopic) {
    checkForSeparator(env_1.default.TOPIC_PREFIX);
    checkForSeparator(env_1.default.NODE_ENV);
    let regexResult = EXTRACT_REGEX.exec(namespacedTopic);
    if (!regexResult || !regexResult[2]) {
        throw new Error(`Could not extract topic from namespaced key ${namespacedTopic}` +
            ` (env: ${env_1.default.NODE_ENV}, prefix: ${env_1.default.TOPIC_PREFIX}`);
    }
    return {
        env: regexResult[1],
        topic: regexResult[2]
    };
}
exports.extractNamespacedTopic = extractNamespacedTopic;
const CONDITION_REGEX = /'(.+?)'/g;
function namespaceCondition(condition) {
    return condition.replace(CONDITION_REGEX, (_, extract) => {
        return "'" + namespaceTopic(extract) + "'";
    });
}
exports.namespaceCondition = namespaceCondition;
//# sourceMappingURL=namespace.js.map