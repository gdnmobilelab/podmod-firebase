import Validators from "./validators";
import { Validator, Options } from "jsonschema";

const validator = new Validator();
validator.addSchema(Validators);

export type ValidatorDefinition = keyof typeof Validators.definitions;

export function validate(obj: any, definitionName: ValidatorDefinition, options?: Options) {
  return validator.validate(obj, Validators.definitions[definitionName], options);
}
