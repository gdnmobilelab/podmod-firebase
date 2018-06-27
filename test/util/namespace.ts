import { namespaceCondition, namespaceTopic } from "../../src/util/namespace";
import { expect } from "chai";
import Environment from "../../src/util/env";

describe("Namespacing", () => {
  it("Should namespace topics", () => {
    let testTopic = "test-topic";
    let namespaced = namespaceTopic(testTopic);
    expect(namespaced).to.eq(`__${Environment.TOPIC_PREFIX}__${Environment.NODE_ENV}__${testTopic}`);
  });

  it("Should namespace conditions", () => {
    let testCondition = "'stock-GOOG' in topics || 'industry-tech' in topics";

    let namespaceOne = namespaceTopic("stock-GOOG");
    let namespaceTwo = namespaceTopic("industry-tech");

    let expected = `'${namespaceOne}' in topics || '${namespaceTwo}' in topics`;

    let namespaced = namespaceCondition(testCondition);
    expect(expected).to.eq(namespaced);
  });
});
