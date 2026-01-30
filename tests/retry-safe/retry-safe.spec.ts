import { StopError } from "../../src/errors";
import { retrySafe } from "../../src/retry-safe";

describe("retrySafe", () => {
	beforeAll(() => {
		jest.useFakeTimers();
		jest.runAllTimersAsync();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it("should call on try and return result ", async () => {
		let calls = 0;

		const res = await retrySafe(() => {
			calls++;
			return "ok";
		});

		expect(res.ok).toBe(true);
		expect(calls).toBe(1);
	});

	it("should call on try and return result if result=null", async () => {
		let calls = 0;

		const res = await retrySafe(() => {
			calls++;
			return null;
		});

		expect(res.ok).toBe(true);
		expect(calls).toBe(1);
	});

	it("should try set number of times", async () => {
		const RETRIES = 5;
		const MAX_TRIES = 15;

		const res = await retrySafe(
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

		const res = await retrySafe(
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
});
