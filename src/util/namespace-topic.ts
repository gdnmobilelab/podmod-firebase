
export function namespaceTopic(topicName:string):string {
    return "_" + process.env.NODE_ENV + "_" + topicName
}