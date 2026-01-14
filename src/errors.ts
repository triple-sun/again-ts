export class AbortError extends Error {
	readonly name: "AbortError";
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

		this.name = "AbortError";
		this.message = message;
	}
}
