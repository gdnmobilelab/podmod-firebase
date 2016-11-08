"use strict";
function namespaceTopic(topicName) {
    return "_" + process.env.NODE_ENV + "_" + topicName;
}
exports.namespaceTopic = namespaceTopic;
function unnamespaceTopic(namespacedTopicName) {
    let split = namespacedTopicName.split("_");
    split.shift();
    let environment = split.shift();
    return {
        topicName: split.join('_'),
        environment: environment
    };
}
exports.unnamespaceTopic = unnamespaceTopic;
//# sourceMappingURL=namespace-topic.js.map