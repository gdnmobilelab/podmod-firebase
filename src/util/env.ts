import { EnvironmentVariables } from "../interface/env";
import Validation from "../../validators/validators";
import { validate } from "jsonschema";

export function check() {
  validate(process.env, Validation.definitions.EnvironmentVariables, { throwError: true });
}

export default (process.env as any) as EnvironmentVariables;
