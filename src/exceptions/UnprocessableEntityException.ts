import { HttpException } from "./HttpException";

// 422 Unprocessable Entity
export class UnprocessableEntityException extends HttpException {
  constructor(message: string = 'Unprocessable Entity') {
    super(422, message);
  }
}