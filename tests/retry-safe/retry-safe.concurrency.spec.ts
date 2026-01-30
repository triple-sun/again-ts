import { retrySafe } from "../../src/retry-safe";
import { wait } from "../../src/utils";

describe("retrySafe", () => {
	it("should try one onTry by default", async () => {
		let calls = 0;
		const TRIES = 5;
		const CONCURRENCY = 1;

		const res = await retrySafe(
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

	it("should try concurrently", async () => {
		let calls = 0;
		const TRIES = 5;
		const CONCURRENCY = 10;

		const res = await retrySafe(
			async ctx => {
				calls++;
				await wait(calls);
				if (ctx.attempts !== TRIES * CONCURRENCY) throw new Error("try again!");
				return "ok";
			},
			{ concurrency: CONCURRENCY, retries: TRIES }
		);

		expect(res.ctx.attempts).toBe(6);
		expect(calls).toBe((TRIES + 1) * CONCURRENCY);
	});
});
