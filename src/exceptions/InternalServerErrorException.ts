import { HttpException } from "./HttpException";

// 500 Internal Server Error
export class InternalServerErrorException extends HttpException {
  constructor(message: string = 'Internal Server Error') {
    super(500, message);
  }
}