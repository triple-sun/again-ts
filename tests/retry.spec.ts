import { StopRetryError } from "../src/errors";
import { retry } from "../src/retry";

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
