import { BadRequestError, HttpError } from "restify-errors";

export class ValidationFailedError extends BadRequestError {
  constructor(message: string, private validationErrors: string[]) {
    super(message);
  }

  toJSON() {
    let base = super.toJSON();
    base.validation_errors = this.validationErrors;
    return base;
  }
}
