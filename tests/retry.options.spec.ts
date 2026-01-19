import { retry } from "../src/retry";

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
