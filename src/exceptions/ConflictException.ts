import { HttpException } from "./HttpException";

// 409 Conflict
export class ConflictException extends HttpException {
  constructor(message: string = 'Conflict') {
    super(409, message);
  }
}