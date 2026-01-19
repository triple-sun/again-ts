import { ErrorTypeError, StopRetryError } from "../src/errors";
import { retry } from "../src/retry";
import { wait } from "../src/utils";

describe("retry error handling  tests", () => {
	it("should remind to throw only Errors", async () => {
		const res = await retry(() => {
			throw "foo";
		});

		expect(res.ctx.errors[0]?.message).toMatch(/Expected instanceof Error/);
	});

	it("no retry on ErrorErrorTypeError", async () => {
		const errorErrorTypeError = new ErrorTypeError(
			"no retry on ErrorErrorTypeError",
		);
		let index = 0;

		const res = await retry(async (c) => {
			await wait(100);
			index++;

			if (c.attempts === 3) return "something";

			throw errorErrorTypeError;
		});

		expect(index).toBe(1);
		expect(res.ctx.errors[0]).toBe(errorErrorTypeError);
	});

	it("retryIf is not called for ErrorErrorTypeError", async () => {
		const errorErrorTypeError = new ErrorTypeError(
			"retryIf is not called for ErrorErrorTypeError",
		);
		let retryIfCalls = 0;

		const res = await retry(
			async () => {
				throw errorErrorTypeError;
			},
			{
				retryIf() {
					retryIfCalls++;
					return true;
				},
			},
		);

		expect(retryIfCalls).toBe(0);
		expect(res.ctx.errors[0]).toBe(errorErrorTypeError);
	});

	it("should abort when signal is aborted", async () => {
		const error = new Error("time to stop");
		const stopError = new StopRetryError(error);

		let count = 0;

		const res = await retry(
			async (c) => {
				await wait(10);
				count++;

				if (c.attempts === 3) throw stopError;

				throw error;
			},
			{
				tries: 10,
				waitMin: 1000,
			},
		);

		expect(count).toBe(3);
		expect(res.ok).toBe(false);
		expect(res.ctx.errors[0]).toBe(error);
		expect(res.ctx.errors[1]).toBe(stopError);
	});

	it("should dedup errors by default", async () => {
		const error = new Error("same error here");
		const res = await retry(() => {
			throw new Error("same error here");
		});

		expect(res.ctx.errors.length).toBe(1);
		expect(res.ctx.errors[0]).toEqual(error);
	});

	it("should not dedup errors if necessacy", async () => {
		const error = new Error("same error here");
		const res = await retry(
			() => {
				throw new Error("same error here");
			},
			{ skipSameErrorCheck: true },
		);

		expect(res.ctx.errors.length).toBe(5);
		expect(res.ctx.errors).toEqual(Array.from({ length: 5 }, () => error));
	});
});
