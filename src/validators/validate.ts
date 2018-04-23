import Validators from "./validators";
import { Validator, Options } from "jsonschema";
import { ValidationFailedError } from "../util/errors";

// This uses the JSON schemas generated in `npm run build-interface-validation` to
// validate incoming request bodies. Primarily it allows us to check that the information
// we are passing directly on to Firebase is actually correct.

const validator = new Validator();
validator.addSchema(Validators);

export type ValidatorDefinition = keyof typeof Validators.definitions;

/**
 * @param  {any} obj the object we want to validate
 * @param  {ValidatorDefinition} definitionName the name of the interface we're checking against.
 */
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
