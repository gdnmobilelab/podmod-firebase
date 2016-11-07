"use strict";
function namespaceTopic(topicName) {
    return process.env.NODE_ENV + "__" + topicName;
}
exports.namespaceTopic = namespaceTopic;
//# sourceMappingURL=namespace-topic.js.map