import { retryify } from "./retryify";

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
			expect(result.ctx.errors[0]?.message).toBe("Got error");
			expect(result.ctx.attempts).toBeGreaterThan(0);
		}
	});

	it("should preserve 'this' context in retryified methods", async () => {
		class TestClass {
			readonly value = "correct";

			async method() {
				if (this.value !== "correct") throw new Error("Wrong context");
				return this.value;
			}
		}

		const instance = new TestClass();

		// @ts-expect-error - assigning to explicit property for testing
		instance.retriedMethod = retryify(instance.method, { tries: 3 });
		// @ts-expect-error - calling the assigned method
		const res = await instance.retriedMethod();
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value).toBe("correct")}
	});
});
