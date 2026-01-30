import { ErrorTypeError, RetryFailedError, StopError } from "../src/errors";

describe("Error Classes", () => {
	describe("StopError", () => {
		it("should create StopError with Error argument", () => {
			const original = new Error("original error");
			const stopErr = new StopError(original);

			expect(stopErr).toBeInstanceOf(StopError);
			expect(stopErr).toBeInstanceOf(Error);
			expect(stopErr.original).toBe(original);
			expect(stopErr.message).toBe("StopError: original error");
			expect(stopErr.name).toBe("StopError");
		});

		it("should create StopError with string argument", () => {
			const stopErr = new StopError("stop message");

			expect(stopErr).toBeInstanceOf(StopError);
			expect(stopErr).toBeInstanceOf(Error);
			expect(stopErr.original).toBeInstanceOf(Error);
			expect(stopErr.original.message).toBe("stop message");
			expect(stopErr.message).toBe("stop message");
			expect(stopErr.name).toBe("StopError");
		});

		it("should preserve stack trace for string argument", () => {
			const stopErr = new StopError("test");

			expect(stopErr.stack).toBeDefined();
			expect(stopErr.original.stack).toBe(stopErr.stack);
		});
	});

	describe("ErrorTypeError", () => {
		it("should create ErrorTypeError with string", () => {
			const err = new ErrorTypeError("some string");

			expect(err).toBeInstanceOf(ErrorTypeError);
			expect(err).toBeInstanceOf(Error);
			expect(err.message).toContain("Expected instanceof Error");
			expect(err.message).toContain("string");
			expect(err.name).toBe("ErrorTypeError");
		});

		it("should create ErrorTypeError with number", () => {
			const err = new ErrorTypeError(123);

			expect(err.message).toContain("number");
		});

		it("should create ErrorTypeError with object", () => {
			const err = new ErrorTypeError({ key: "value" });

			expect(err.message).toContain("object");
		});

		it("should create ErrorTypeError with null", () => {
			const err = new ErrorTypeError(null);

			expect(err.message).toContain("object"); // typeof null is "object"
		});

		it("should create ErrorTypeError with undefined", () => {
			const err = new ErrorTypeError(undefined);

			expect(err.message).toContain("undefined");
		});
	});

	describe("RetryFailedError", () => {
		it("should create RetryFailedError with context", () => {
			const ctx = {
				errors: [new Error("error1"), new Error("error2")],
				attempts: 5,
				retriesConsumed: 4,
				start: 100,
				end: 200
			};

			const err = new RetryFailedError(ctx);

			expect(err).toBeInstanceOf(RetryFailedError);
			expect(err).toBeInstanceOf(Error);
			expect(err.ctx).toBe(ctx);
			expect(err.name).toBe("RetryFailedError");
			expect(err.message).toContain("Retry failed");
			expect(err.message).toContain("error2"); // Last error
		});

		it("should handle context with single error", () => {
			const ctx = {
				errors: [new Error("only error")],
				attempts: 2,
				retriesConsumed: 1,
				start: 100,
				end: 150
			};

			const err = new RetryFailedError(ctx);

			expect(err.message).toContain("only error");
		});
	});
});
