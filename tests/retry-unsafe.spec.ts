import { retry } from "../src";
import { RetryFailedError, StopError } from "../src/errors";
import type { OnTryFunction } from "../src/types";
import { wait } from "../src/utils";

describe("retryUnsafe", () => {
	it("should return result directly on first try", async () => {
		const fn = jest.fn().mockResolvedValue("success");
		const result = await retry("unsafe", fn);
		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("should retry until success", async () => {
		const fn = jest
			.fn()
			.mockRejectedValueOnce(new Error("fail 1"))
			.mockRejectedValueOnce(new Error("fail 2"))
			.mockResolvedValue("success");

		const result = await retry("unsafe", fn, { retries: 5 });
		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("should throw RetryFailedError when retries exhausted", async () => {
		const error = new Error("fail always");
		const fn = jest.fn().mockRejectedValue(error);

		try {
			await retry("unsafe", fn, { retries: 3, skipSameErrorCheck: true });
		} catch (err) {
			expect(err).toBeInstanceOf(RetryFailedError);
			if (err instanceof RetryFailedError) {
				expect(err.ctx.errors).toHaveLength(4);
				expect(err.ctx.errors[0]).toBe(error);
				expect(err.ctx.retriesConsumed).toBe(3);
			}
		}
		expect(fn).toHaveBeenCalledTimes(4);
	});

	it("should allow infinite retries", async () => {
		let counter = 0;
		const fn = jest.fn(() => {
			counter++;
			if (counter < 20) throw new Error("fail");
			return "success";
		});

		// Pass tries: Infinity explicitly since default is 5
		const result = await retry("unsafe", fn, {
			retries: Number.POSITIVE_INFINITY,
			waitMin: 0
		});
		expect(result).toBe("success");
		expect(counter).toBe(20);
	});

	it("should handle StopError to abort retries immediately", async () => {
		let calls = 0;
		const stopError = new StopError("stop right now");

		const onTry: OnTryFunction<void> = ctx => {
			calls++;

			if (ctx.attempts === 2) throw stopError;

			throw new Error("try again!");
		};

		try {
			await retry("unsafe", onTry, { retries: 5 });
			throw new Error("Should have thrown");
		} catch (err) {
			// retryUnsafe wraps all failures in RetryFailedError
			expect(err).toBeInstanceOf(RetryFailedError);
			if (err instanceof RetryFailedError) {
				// The original error from StopError is saved to context
				const lastError = err.ctx.errors[err.ctx.errors.length - 1];
				expect(lastError).toBeInstanceOf(Error);
				expect(lastError?.message).toBe("stop right now");
			}
		}
		expect(calls).toEqual(2);
	});

	it("should support concurrency", async () => {
		// with concurrency, multiple attempts are fired.
		// first one to resolve wins.
		// if all fail, we retry.

		let callCount = 0;
		const fn = jest.fn(async () => {
			callCount++;
			await wait(10);
			if (callCount <= 2) throw new Error("fail"); // first 2 fail
			return "success"; // 3rd succeeds
		});

		const result = await retry("unsafe", fn, { retries: 1, concurrency: 3 });
		expect(result).toBe("success");
		expect(callCount).toBe(3);
	});

	it("should respect AbortSignal", async () => {
		const controller = new AbortController();
		const fn = jest.fn(async () => {
			await wait(50);
			return "success";
		});

		const promise = retry("unsafe", fn, { signal: controller.signal });
		controller.abort();

		await expect(promise).rejects.toThrow();
	});

	it("should handle sync errors in onTry", async () => {
		const fn = jest.fn(() => {
			throw new Error("sync error");
		});

		await expect(retry("unsafe", fn, { retries: 1 })).rejects.toThrow(
			RetryFailedError
		);
	});
});
