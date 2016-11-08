"use strict";
function namespaceTopic(topicName) {
    return "_" + process.env.NODE_ENV + "_" + topicName;
}
exports.namespaceTopic = namespaceTopic;
function unnamespaceTopic(namespacedTopicName) {
    let split = namespacedTopicName.split("_");
    split.shift();
    let topicName = split.shift();
    return {
        topicName: topicName,
        environment: split.join('_')
    };
}
exports.unnamespaceTopic = unnamespaceTopic;
//# sourceMappingURL=namespace-topic.js.map