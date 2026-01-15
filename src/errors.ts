export class StopRetryError extends Error {
	readonly name: typeof StopRetryError.name;
	readonly original: Error;
	constructor(message: string | Error) {
		super();

		if (message instanceof Error) {
			this.original = message;
			({ message } = message);
		} else {
			this.original = new Error(message);
			this.original.stack = this.stack;
		}

		this.name = StopRetryError.name;
		this.message = message;
	}
}

export class ErrorTypeError extends Error {
		readonly name: typeof ErrorTypeError.name;

		constructor(e: unknown) {
			super();

			this.message = `Expected instanceof Error, got: "${typeof e}"`;
			this.name = ErrorTypeError.name;
		}
	}
