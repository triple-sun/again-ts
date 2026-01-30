import type { RetryContext } from ".";

export class StopError extends Error {
	readonly original: Error;
	constructor(messageOrError: string | Error) {
		super();

		if (messageOrError instanceof Error) {
			this.original = messageOrError;
			this.message = messageOrError.message;
		} else {
			this.message = messageOrError;
			this.original = new Error(messageOrError);
			this.original.stack = this.stack;
		}

		this.name = StopError.name;
	}
}

export class ErrorTypeError extends Error {
	constructor(e: unknown) {
		super();
		this.message = `Expected instanceof Error, got: "${typeof e}"`;
		this.name = ErrorTypeError.name;
	}
}

export class RetryFailedError extends Error {
	readonly ctx: RetryContext;

	constructor(ctx: Readonly<RetryContext>) {
		super();

		this.ctx = ctx;
		this.name = RetryFailedError.name;
		this.message = `Retry failed: ${this.ctx.errors[this.ctx.errors.length - 1]}`;
	}
}
