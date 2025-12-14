export class CustomException {
	constructor(public errorCode: string, public errorMessage: string, public actualError: string) {}
	getErrorMessage() {
		return JSON.stringify({ errorCode: this.errorCode, errorMessage: this.errorMessage });
	}
	getActualError() {
		return JSON.stringify({ errorCode: this.errorCode, errorMessage: this.errorMessage, actualError: this.actualError });
	}
}

export class DispatchException extends CustomException {
	static REDIS_QUEUE_EXCEPTION = 'DISPATCH_01';
	static MONGODB_QUERY_EXCEPTION = `DISPATCH_02`;
	static HTTP_EXCEPTION = `DISPATCH_03`;
	static INVALID_PAYLOAD = `DISPATCH_04`;

	constructor(public errorCode: string, public errorMessage: string, public actualError: string) {
		super(errorCode, errorMessage, actualError);
	}
}
