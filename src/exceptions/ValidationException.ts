import { HttpException } from "./HttpException";

// Custom validation exception with field details
export class ValidationException extends HttpException {
  public errors: Array<{ field: string; message: string }>;

  constructor(errors: Array<{ field: string; message: string }> | string) {
    const message = typeof errors === 'string' ? errors : 'Validation Failed';
    super(400, message);
    this.errors = typeof errors === 'string' ? [] : errors;
  }
}
