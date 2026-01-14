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
		expect(res.context.attempts).toBe(TRIES);
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
		expect(res.context.attempts).toBe(TRIES_LIMIT);
		expect(calls).toBe(TRIES_LIMIT);
	});
});

describe("retry error tests", () => {
	// Error Handling Tests
	it("should remind to throw ony Errors", async () => {
		const res = await retry(() => {
			throw "foo";
		});

		expect(res.context.errors[0]?.message).toMatch(/Expected instanceof Error/);
	});



	it("no retry on ErrorTypeError", async () => {
		const errorTypeError = new ErrorTypeError("placeholder");
		let index = 0;

		const res = await retry(async (c) => {
				await wait(40);
				index++;

				if (c.attempts === 3) return 'something';

				throw errorTypeError
			})

		expect(index).toBe(1);
		expect(res.context.errors[0]).toBe(errorTypeError)
	});

	/**
	it("shouldRetry is not called for non-network TypeError", async (t) => {
		const typeErrorFixture = new TypeError("type-error-fixture");
		let shouldRetryCalled = 0;

		await t.throwsAsync(
			pRetry(
				async () => {
					throw typeErrorFixture;
				},
				{
					shouldRetry() {
						shouldRetryCalled++;
						return true;
					},
				},
			),
			{ is: typeErrorFixture },
		);

		t.is(shouldRetryCalled, 0);
	});

	 */
});

/**
describe("retry tests", () => {
	it("should abort when signal is aborted outside of onTry fn", async () => {
		const controller = new AbortController();
		const error = new Error("fail");
		const onTry = jest.fn().mockImplementation(async () => {
			await wait(100);
			throw error;
		});

		const res = await retry(onTry, {
			tries: 10,
			waitMin: 1000,
			signal: controller.signal,
		});

		controller.abort(new Error("Aborted via signal"));

		expect(res.ok).toBe(false);
		expect(res.context.errors).toContainEqual(error);

		console.log(res.context);
	});

	it("should stop when limit is exceeded", async () => {
		const onTry = jest.fn().mockImplementation(() => {
			throw new Error("fail");
		});

		const res = await retry(onTry, { tries: 10, waitMin: 100, timeLimit: 250 });

		expect(res.ok).toBe(false);
		expect(res.context.end - res.context.start).toBeCloseTo(250);
	});

	it("should respect consumeIf", async () => {
		const onTry = jest.fn().mockRejectedValue(new Error("fail"));

		// consumeIf returns false for first 2 calls
		let count = 0;

		const res = await retry(onTry, {
			tries: 5,
			waitMin: 10,
			consumeIf: jest.fn(async (c) => {
				count++;
				if (c.triesLeft > 0) throw new Error("there are more tries left!");
				return count > 2;
			}),
		});

		expect(res.ok).toBe(false);
		expect(res.context.triesConsumed).toBe(5);
		expect(res.context.attempts).toBe(7);
	});

	it("should correctly calculate triesLeft", async () => {
		const onTry = jest.fn().mockRejectedValue(new Error("fail"));
		const res = await retry(onTry, { tries: 3, waitMin: 1 });

		if (!res.ok) {
			expect(res.context.triesLeft).toBe(0);
			expect(res.context.attempts).toBe(3);
		}
	});

	it("should call onCatch with context", async () => {
		const onTry = jest.fn().mockRejectedValue(new Error("fail"));
		const onCatch = jest.fn();

		await retry(onTry, { tries: 2, waitMin: 1, onCatch });

		expect(onCatch).toHaveBeenCalledTimes(2);
		expect(onCatch).toHaveBeenCalledWith(
			expect.objectContaining({
				attempts: expect.any(Number),
				errors: expect.any(Array),
			}),
		);
	});
});
 */
