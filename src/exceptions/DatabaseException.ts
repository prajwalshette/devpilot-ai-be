import { HttpException } from "./HttpException";

// Database exception
export class DatabaseException extends HttpException {
  public field?: string;

  constructor(message: string = 'Database Error', field?: string) {
    super(500, message);
    this.field = field;
  }
}