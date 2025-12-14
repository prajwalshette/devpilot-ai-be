import { HttpException } from "./HttpException";

// 401 Unauthorized
export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}