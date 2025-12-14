import { HttpException } from "./HttpException";

// 403 Forbidden
export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}