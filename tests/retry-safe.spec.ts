/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: <jest> */
import { retry } from "../src";
import { ErrorTypeError, StopError } from "../src/errors";
import { wait } from "../src/utils";

describe("retrySafe", () => {
	beforeAll(() => {
		jest.useFakeTimers();
		jest.runAllTimersAsync();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	describe("basic tests", () => {
		it("should call on try and return result ", async () => {
			let calls = 0;

			const res = await retry("safe", () => {
				calls++;
				return "ok";
			});

			expect(res.ok).toBe(true);
			expect(calls).toBe(1);
		});

		it("should call on try and return result if result=null", async () => {
			let calls = 0;

			const res = await retry("safe", () => {
				calls++;
				return null;
			});

			expect(res.ok).toBe(true);
			expect(calls).toBe(1);
		});

		it("should try set number of times", async () => {
			const RETRIES = 5;
			const MAX_TRIES = 15;

			const res = await retry(
				"safe",
				c => {
					if (c.attempts === MAX_TRIES) return;
					throw new Error(`Error ${c.attempts}`);
				},
				{ retries: RETRIES }
			);

			expect(res.ok).toBe(false);
			expect(res.ctx.attempts).toBe(RETRIES + 1);
			expect(res.ctx.errors).toEqual(
				expect.arrayContaining([new Error(`Error 5`)])
			);
		});

		it("should try infinite number of times", async () => {
			const TRIES_LIMIT = 15; //limit for testing

			let calls = 0;

			const res = await retry(
				"safe",
				c => {
					calls++;
					if (c.attempts === TRIES_LIMIT) {
						throw new StopError("time to stop");
					}

					throw new Error(`Error ${c.attempts}`);
				},
				{ retries: Number.POSITIVE_INFINITY }
			);

			expect(res.ok).toBe(false);
			expect(res.ctx.attempts).toBe(TRIES_LIMIT);
			expect(calls).toBe(TRIES_LIMIT);
		});

		it("should stop when limit is exceeded", async () => {
			const res = await retry(
				"safe",
				() => {
					throw new Error("fail");
				},
				{ retries: 10, waitMin: 100, timeMax: 250 }
			);

			expect(res.ok).toBe(false);
			expect(res.ctx.end - res.ctx.start).toBeLessThanOrEqual(255);
		});

		it("should respect consumeIf", async () => {
			const TRIES = 5;

			const res = await retry(
				"safe",
				() => {
					throw new Error("fail");
				},
				{
					retries: TRIES,
					consumeIf: c => {
						if (c.attempts > 2) return true;
						return false;
					}
				}
			);

			expect(res.ok).toBe(false);
			expect(res.ctx.retriesConsumed).toBe(5);
			expect(res.ctx.attempts).toBe(8);
		});

		it("should respect consumeIf even if it throws", async () => {
			const TRIES = 5;

			const res = await retry(
				"safe",
				() => {
					throw new Error("fail");
				},
				{
					retries: TRIES,
					consumeIf: c => {
						if (c.attempts > 2) return true;
						return false;
					}
				}
			);

			expect(res.ok).toBe(false);
			expect(res.ctx.retriesConsumed).toBe(5);
			expect(res.ctx.attempts).toBe(8);
		});

		it("should call onCatch with context on every try (including 1st)", async () => {
			const onCatch = jest.fn();

			await retry(
				"safe",
				() => {
					throw new Error("onCatch onTry test error");
				},
				{ retries: 2, waitMin: 1, onCatch }
			);

			expect(onCatch).toHaveBeenCalledTimes(3);
			expect(onCatch).toHaveBeenCalledWith(
				expect.objectContaining({
					attempts: expect.any(Number),
					errors: expect.any(Array)
				})
			);
		});
	});

	describe("errors", () => {
		it("should remind to throw only Errors", async () => {
			const res = await retry("safe", () => {
				throw "foo";
			});

			expect(res.ctx.errors[0]?.message).toMatch(/Expected instanceof Error/);
		});

		it("no retry on ErrorTypeError", async () => {
			const errorTypeError = new ErrorTypeError("no retry on ErrorTypeError");
			let index = 0;

			const res = await retry("safe", async ctx => {
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

			const res = await retry("safe", async c => {
				await wait(100);
				index++;

				if (c.attempts === 3) throw stopRetryError;

				throw new Error("try again!");
			});

			expect(index).toBe(3);
			expect(res.ctx.errors[2]).toBe(stopRetryError);
		});

		it("retryIf is not called for ErrorTypeError", async () => {
			const notAnErrorError = new ErrorTypeError(
				"retryIf is not called for ErrorTypeError"
			);

			let retryIfCalls = 0;

			const res = await retry(
				"safe",
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

			const res = await retry(
				"safe",
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
			const res = await retry(
				"safe",
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
			const res = await retry("safe", () => {
				throw new Error("same error here");
			});

			expect(res.ctx.errors.length).toBe(5);
			expect(res.ctx.errors).toEqual(Array.from({ length: 5 }, () => error));
		});
	});

	describe("concurrency", () => {
		it("should not try concurrently by default", async () => {
			let calls = 0;
			const TRIES = 5;
			const CONCURRENCY = 1;

			const res = await retry(
				"safe",
				async () => {
					calls++;
					await wait(10);
					throw new Error("try again!");
				},
				{ retries: TRIES, waitMin: 0 }
			);

			expect(res.ctx.attempts).toBe(TRIES + 1);
			expect(calls).toBe((TRIES + 1) * CONCURRENCY);
		});

		it("should try concurrently if needed", async () => {
			let calls = 0;
			const TRIES = 5;
			const CONCURRENCY = 10;

			const res = await retry(
				"safe",
				async ctx => {
					calls++;
					await wait(calls);
					if (ctx.attempts !== TRIES * CONCURRENCY)
						throw new Error("try again!");
					return "ok";
				},
				{ concurrency: CONCURRENCY, retries: TRIES }
			);

			expect(res.ctx.attempts).toBe(6);
			expect(calls).toBe((TRIES + 1) * CONCURRENCY);
		});
	});

	describe("aborts", () => {
		it("should abort immediately when signal is aborted before start", async () => {
			const error = new Error("reason");
			const controller = new AbortController();
			controller.abort(error);

			const res = await retry(
				"safe",
				() => {
					throw new Error("should not run");
				},
				{ signal: controller.signal }
			);

			expect(res.ok).toBe(false);
			expect(res.ctx.errors[0]).toBe(error);
			expect(res.ctx.errors[0]?.message).toContain("reason");
		});

		it("should abort during wait", async () => {
			const controller = new AbortController();
			const error = new Error("fail");
			const abortSignalError = new Error("aborted during wait");

			const promise = retry(
				"safe",
				() => {
					throw new Error("fail");
				},
				{
					retries: 5,
					waitMin: 1000,
					signal: controller.signal
				}
			);

			// let it fail once and enter wait
			await wait(100);
			controller.abort(abortSignalError);

			const res = await promise;
			expect(res.ok).toBe(false);
			expect(res.ctx.errors).toHaveLength(2);
			expect(res.ctx.errors[0]).toEqual(error);
		});

		it("should process abort triggers between retry steps", async () => {
			const error = new Error("fail");
			const controller = new AbortController();
			const abortReason = new Error("aborted loop");
			let attempts = 0;

			const promise = retry(
				"safe",
				() => {
					attempts++;
					if (attempts === 2) controller.abort(abortReason);
					throw error;
				},
				{
					retries: 5,
					waitMin: 10,
					signal: controller.signal
				}
			);

			const res = await promise;
			expect(res.ok).toBe(false);
			expect(attempts).toBe(2);
			expect(res.ctx.errors[res.ctx.errors.length - 1]).toEqual(error);
		});
	});
});
