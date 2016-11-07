
export function namespaceTopic(topicName:string):string {
    return process.env.NODE_ENV + "__" + topicName
}