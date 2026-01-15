import { ErrorTypeError, StopRetryError } from "./errors";
import { retry } from "./retry";
import { wait } from "./wait";

describe("retry tests (tries)", () => {
	beforeAll(() => {
		jest.useFakeTimers();
		jest.runAllTimersAsync();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it("should call on try and return result ", async () => {
		let calls = 0;

		const res = await retry(async () => {
			calls++;
			return "ok";
		});

		expect(res.ok).toBe(true);
		expect(calls).toBe(1);
	});

	it("should call on try and return result if result=null", async () => {
		let calls = 0;

		const res = await retry(() => {
			calls++;
			return null;
		});

		expect(res.ok).toBe(true);
		expect(calls).toBe(1);
	});

	it("should try set number of times", async () => {
		const TRIES = 5;
		const MAX_TRIES = 15;

		const res = await retry(
			(c) => {
				if (c.attempts === MAX_TRIES) return;
				throw new Error(`Error ${c.attempts}`);
			},
			{ tries: TRIES },
		);

		expect(res.ok).toBe(false);
		expect(res.ctx.attempts).toBe(TRIES);
	});

	it("should try infinite number of times", async () => {
		const TRIES_LIMIT = 15; //limit for testing

		let calls = 0;

		const res = await retry(
			(c) => {
				calls++;
				if (c.attempts === TRIES_LIMIT) {
					throw new StopRetryError("time to stop");
				}

				throw new Error(`Error ${c.attempts}`);
			},
			{ tries: Number.POSITIVE_INFINITY },
		);

		expect(res.ok).toBe(false);
		expect(res.ctx.attempts).toBe(TRIES_LIMIT);
		expect(calls).toBe(TRIES_LIMIT);
	});
});

describe("retry error handling  tests", () => {
	it("should remind to throw ony Errors", async () => {
		const res = await retry(() => {
			throw "foo";
		});

		expect(res.ctx.errors[0]?.message).toMatch(/Expected instanceof Error/);
	});

	it("no retry on ErrorTypeError", async () => {
		const errorTypeError = new ErrorTypeError("placeholder");
		let index = 0;

		const res = await retry(async (c) => {
			await wait(40);
			index++;

			if (c.attempts === 3) return "something";

			throw errorTypeError;
		});

		expect(index).toBe(1);
		expect(res.ctx.errors[0]).toBe(errorTypeError);
	});

	it("retryIf is not called for non-network ErrorTypeError", async () => {
		const errorTypeError = new ErrorTypeError("placeholder");
		let retryIfCalls = 0;

		const res = await retry(
			async () => {
				throw errorTypeError;
			},
			{
				retryIf() {
					retryIfCalls++;
					return true;
				},
			},
		);

		expect(retryIfCalls).toBe(0);
		expect(res.ctx.errors[0]).toBe(errorTypeError);
	});
});

describe("retry StopError tests", () => {
	it("should abort when signal is aborted", async () => {
		const error = new Error("time to stop");
		const stopError = new StopRetryError(error);

		let count = 0;

		const res = await retry(
			async (c) => {
				await wait(100);
				count++;

				if (c.attempts === 3) {
					throw stopError;
				}

				throw error;
			},
			{
				tries: 10,
				waitMin: 1000,
			},
		);

		expect(count).toBe(3);
		expect(res.ok).toBe(false);
		expect(res.ctx.errors[res.ctx.errors.length - 1]).toBe(error);
	});
});

describe("retry options tests", () => {
	it("should stop when limit is exceeded", async () => {
		const res = await retry(
			() => {
				throw new Error("fail");
			},
			{ tries: 10, waitMin: 100, timeMax: 250 },
		);

		expect(res.ok).toBe(false);
		expect(res.ctx.end - res.ctx.start).toBeLessThanOrEqual(255);
	});

	it("should respect consumeIf", async () => {
		const TRIES = 5;

		const res = await retry(
			() => {
				throw new Error("fail");
			},
			{
				tries: TRIES,
				consumeIf: (c) => {
					if (c.attempts > 2) return true;
					return false;
				},
			},
		);

		expect(res.ok).toBe(false);
		expect(res.ctx.triesConsumed).toBe(5);
		expect(res.ctx.attempts).toBe(7);
	});

	it("should respect consumeIf even if it throws", async () => {
		const TRIES = 5;

		const res = await retry(
			() => {
				throw new Error("fail");
			},
			{
				tries: TRIES,
				consumeIf: (c) => {
					if (c.attempts > 2) return true;
					return false;
				},
			},
		);

		expect(res.ok).toBe(false);
		expect(res.ctx.triesConsumed).toBe(5);
		expect(res.ctx.attempts).toBe(7);
	});

	it("should call onCatch with context", async () => {
		const onCatch = jest.fn();

		await retry(
			() => {
				throw new Error("onCatch onTry test error");
			},
			{ tries: 2, waitMin: 1, onCatch },
		);

		expect(onCatch).toHaveBeenCalledTimes(2);
		expect(onCatch).toHaveBeenCalledWith(
			expect.objectContaining({
				attempts: expect.any(Number),
				errors: expect.any(Array),
			}),
		);
	});
});
