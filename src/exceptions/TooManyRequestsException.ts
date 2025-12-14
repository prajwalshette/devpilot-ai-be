import { HttpException } from "./HttpException";

// 429 Too Many Requests
export class TooManyRequestsException extends HttpException {
  constructor(message: string = 'Too Many Requests') {
    super(429, message);
  }
}