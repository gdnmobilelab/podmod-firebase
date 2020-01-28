import { BadRequestError, HttpError, InternalServerError } from "restify-errors";

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

export class RemoteServerError extends InternalServerError {
  constructor(message: string, public responseJSON: any) {
    super(message);
  }
}
