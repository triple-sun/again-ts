import { retry } from "./retry";
import { wait } from "./utils";

describe("retry concurrency tests", () => {
	it("should try one onTry by default", async () => {
		let calls = 0;
		const TRIES = 5;
		const CONCURRENCY = 1;

		const res = await retry(
			async () => {
				calls++;
				await wait(10);
				throw new Error("try again!");
			},
			{ concurrency: CONCURRENCY, tries: TRIES, waitMin: 0 },
		);

		expect(res.ctx.attempts).toBe(TRIES);
		expect(calls).toBe(TRIES * CONCURRENCY);
	});

	it("should try concurrently", async () => {
		let calls = 0;
		const TRIES = 5;
		const CONCURRENCY = 10;

		const res = await retry(
			async (ctx) => {
				calls++;
				await wait(calls);
				if (ctx.attempts !== TRIES * CONCURRENCY) throw new Error("try again!");
				return "ok";
			},
			{ concurrency: CONCURRENCY, tries: TRIES },
		);

		expect(res.ctx.attempts).toBe(5);
		expect(calls).toBe(TRIES * CONCURRENCY);
	});
});
