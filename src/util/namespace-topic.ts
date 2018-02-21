export function namespaceTopic(topicName: string): string {
  return "_" + process.env.NODE_ENV + "_" + topicName;
}

interface TopicAndNamespace {
  topicName: string;
  environment: string;
}

export function unnamespaceTopic(namespacedTopicName: string): TopicAndNamespace {
  let split = namespacedTopicName.split("_");
  split.shift();
  let environment = split.shift();
  return {
    topicName: split.join("_"),
    environment: environment
  };
}
