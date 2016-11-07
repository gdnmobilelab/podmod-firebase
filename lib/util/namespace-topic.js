"use strict";
function namespaceTopic(topicName) {
    return "_" + process.env.NODE_ENV + "_" + topicName;
}
exports.namespaceTopic = namespaceTopic;
//# sourceMappingURL=namespace-topic.js.map