import { HttpException } from "./HttpException";

// 503 Service Unavailable
export class ServiceUnavailableException extends HttpException {
  constructor(message: string = 'Service Unavailable') {
    super(503, message);
  }
}