import { retrySafe } from "../../src/retry-safe";

describe("retrySafe", () => {
	it("should stop when limit is exceeded", async () => {
		const res = await retrySafe(
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

		const res = await retrySafe(
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

		const res = await retrySafe(
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

		await retrySafe(
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
