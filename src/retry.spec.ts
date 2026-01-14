import { retry, retryify } from "./retry";

describe("retry tests", () => {
	beforeAll(() => {
		jest.useFakeTimers();
		jest.runAllTimersAsync();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it("should call on try and return result ", async () => {
		const onTry = jest.fn(() => {
			return "ok";
		});
		const res = await retry(async () => onTry());

		expect(res.ok).toBe(true);
		expect(onTry).toHaveBeenCalledTimes(1);
	});

	it("should try set number of times if throws every time", async () => {
		const TRIES = 5;
		const onTry = jest.fn((att: number) => {
			throw new Error(`error${att}`);
		});

		const res = await retry((att) => onTry(att), { tries: TRIES });

		expect(res.ok).toBe(false);
		if (res.ok === false) {
			expect(res.context.attempts).toBe(TRIES);
			expect(res.context.triesLeft).toBe(0);
		}
		expect(onTry).toHaveBeenCalledTimes(TRIES);
	});

	it("should abort when signal is aborted", async () => {
		const controller = new AbortController();
		const error = new Error("fail");
		const onTry = jest.fn().mockImplementation(() => {
			throw error
		});

		const res = await retry(onTry, {
			tries: 10,
			waitMin: 1000,
			signal: controller.signal,
		});

		controller.abort(new Error("Aborted via signal"));

		expect(res.ok).toBe(false);
		expect(res.context.errors).toContainEqual(error)
	});

	it("should stop when limit is exceeded", async () => {
		const onTry = jest.fn().mockImplementation((c) => {
			throw new Error("fail");
		});

		const res = await retry(onTry, { tries: 10, waitMin: 100, timeLimit: 250 });

		expect(res.ok).toBe(false);
		expect(res.context.end - res.context.start).toBeCloseTo(250)
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

		// We expect failure.
		// Check context.
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

describe("retryify tests", () => {
	it("should handle retryify correctly", async () => {
		const testFn = (i: number) => {
			if (Math.random() > 0) {
				return `Got ${i}!`;
			} else {
				throw new Error("Got error!");
			}
		};

		const retriableTestFn = retryify(testFn, { tries: 5 });
		const result = await retriableTestFn(10);

		if (result.ok) {
			expect(result.value).toBe(`Got 10!`);
		} else {
			expect(result.context.errors[0]?.message).toBe("Got error");
			expect(result.context.attempts).toBeGreaterThan(0);
		}
	});
});
