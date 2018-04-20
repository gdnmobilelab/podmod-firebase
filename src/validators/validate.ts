import Validators from "./validators";
import { Validator, Options } from "jsonschema";
import { ValidationFailedError } from "../util/errors";

const validator = new Validator();
validator.addSchema(Validators);

export type ValidatorDefinition = keyof typeof Validators.definitions;

export function validate(obj: any, definitionName: ValidatorDefinition) {
  let validationResult = validator.validate(obj, Validators.definitions[definitionName]);
  if (validationResult.errors.length > 0) {
    let err = new ValidationFailedError(
      "Object validation failed",
      (validationResult.errors as any[]).map(e => e.stack)
    );
    throw err;
  }
}
