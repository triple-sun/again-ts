import { RetryFailedError } from "../src/errors";
import { retryifySafe, retryifyUnsafe } from "../src/retryify";

describe("retryifySafe", () => {
	it("should handle retryifySafe correctly", async () => {
		const testFn = (i: number) => {
			if (Math.random() > 0) {
				return `Got ${i}!`;
			} else {
				throw new Error("Got error!");
			}
		};

		const retriableTestFn = retryifySafe(testFn, { retries: 5 });
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

			method() {
				if (this.value !== "correct") throw new Error("Wrong context");
				return this.value;
			}
		}

		const instance = new TestClass();

		// @ts-expect-error - assigning to explicit property for testing
		instance.retriedMethod = retryifySafe(instance.method, { retries: 3 });
		// @ts-expect-error - calling the assigned method
		const res = await instance.retriedMethod();
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value).toBe("correct");
		}
	});
});

describe("retryifyUnsafe", () => {
	it("should handle retryifyUnsafe correctly", async () => {
		const testFn = (i: number) => {
			return `Got ${i}!`;
		};

		const retriableTestFn = retryifyUnsafe(testFn, { retries: 5 });
		const result = await retriableTestFn(10);

		expect(result).toBe(`Got 10!`);
	});

	it("should handle retryifyUnsafe errors correctly", async () => {
		const err = new Error("Got error!");
		const testFn = () => {
			throw err;
		};

		try {
			await retryifyUnsafe(testFn, { retries: 5 });
			// biome-ignore lint/suspicious/noExplicitAny: <testing>
		} catch (err: any) {
			expect(err).toBeInstanceOf(RetryFailedError);
			expect(err.ctx.errors).toEqual(expect.arrayContaining([err]));
		}
	});

	it("should preserve 'this' context in retryified methods", async () => {
		class TestClass {
			readonly value = "correct";

			method() {
				if (this.value !== "correct") throw new Error("Wrong context");
				return this.value;
			}
		}

		const instance = new TestClass();

		// @ts-expect-error - assigning to explicit property for testing
		instance.method = retryifyUnsafe(instance.method, { retries: 3 });
		const res = await instance.method();
		expect(res).toBe("correct");
	});
});
