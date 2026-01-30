import { retrySafe } from "../../src/retry-safe";
import { wait } from "../../src/utils";

describe("retrySafe", () => {
	it("should abort immediately when signal is aborted before start", async () => {
		const error = new Error("reason");
		const controller = new AbortController();
		controller.abort(error);

		const res = await retrySafe(
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

		const promise = retrySafe(
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

		const promise = retrySafe(
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
