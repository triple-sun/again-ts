import { ErrorTypeError, StopError } from "../../src/errors";
import { retrySafe } from "../../src/retry-safe";
import { wait } from "../../src/utils";

describe("retrySafe", () => {
	it("should remind to throw only Errors", async () => {
		const res = await retrySafe(() => {
			throw "foo";
		});

		expect(res.ctx.errors[0]?.message).toMatch(/Expected instanceof Error/);
	});

	it("no retry on ErrorTypeError", async () => {
		const errorTypeError = new ErrorTypeError("no retry on ErrorTypeError");
		let index = 0;

		const res = await retrySafe(async ctx => {
			await wait(100);
			index++;

			if (ctx.attempts === 3) {
				throw errorTypeError;
			}

			throw new Error("try again!");
		});

		expect(index).toBe(3);
		expect(res.ctx.errors[2]).toBe(errorTypeError);
	});

	it("no retry on StopError", async () => {
		const stopRetryError = new StopError("no retry on StopError");
		let index = 0;

		const res = await retrySafe(async c => {
			await wait(100);
			index++;

			if (c.attempts === 3) throw stopRetryError;

			throw new Error("try again!");
		});

		expect(index).toBe(3);
		expect(res.ctx.errors[2]).toBe(stopRetryError);
	});

	it("retryIf is not called for NotAnErrorError", async () => {
		const notAnErrorError = new ErrorTypeError(
			"retryIf is not called for NotAnErrorError"
		);
		let retryIfCalls = 0;

		const res = await retrySafe(
			() => {
				throw notAnErrorError;
			},
			{
				retryIf() {
					retryIfCalls++;
					return true;
				}
			}
		);

		expect(retryIfCalls).toBe(0);
		expect(res.ctx.errors[0]).toBe(notAnErrorError);
	});

	it("should abort when signal is aborted", async () => {
		const error = new Error("time to stop");
		const stopError = new StopError(error);

		let count = 0;

		const res = await retrySafe(
			async c => {
				await wait(10);
				count++;

				if (c.attempts === 3) throw stopError;

				throw error;
			},
			{
				retries: 10,
				waitMin: 1000
			}
		);

		expect(count).toBe(3);
		expect(res.ok).toBe(false);
		expect(res.ctx.errors).toEqual(
			expect.arrayContaining([error, error, stopError])
		);
	});

	it("should dedup errors if necessary", async () => {
		const error = new Error("same error here");
		const res = await retrySafe(
			() => {
				throw new Error("same error here");
			},
			{ skipSameErrorCheck: false }
		);

		expect(res.ctx.errors.length).toBe(1);
		expect(res.ctx.errors[0]).toEqual(error);
	});

	it("should not dedup errors by default", async () => {
		const error = new Error("same error here");
		const res = await retrySafe(() => {
			throw new Error("same error here");
		});

		expect(res.ctx.errors.length).toBe(5);
		expect(res.ctx.errors).toEqual(Array.from({ length: 5 }, () => error));
	});
});
