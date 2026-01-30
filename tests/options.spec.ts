import {
	BOOL_FN_DEFAULT,
	CONCURRENCY_DEFAULT,
	FACTOR_DEFAULT,
	LINEAR_DEFAULT,
	ON_CATCH_DEFAULT,
	RANDOM_DEFAULT,
	RETRIES_DEFAULT,
	SKIP_SAME_ERROR_CHECK_DEFAULT,
	TIME_MAX_DEFAULT,
	WAIT_IF_NOT_CONSUMED_DEFAULT,
	WAIT_MAX_DEFAULT,
	WAIT_MIN_DEFAULT
} from "../src/defaults";
import { createInternalOptions, validateOptions } from "../src/utils";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <jest!>
describe("Options Handling", () => {
	describe("createInternalOptions", () => {
		it("should use all defaults when empty options provided", () => {
			const opts = createInternalOptions({});

			expect(opts.retries).toBe(RETRIES_DEFAULT);
			expect(opts.timeMax).toBe(TIME_MAX_DEFAULT);
			expect(opts.waitMin).toBe(WAIT_MIN_DEFAULT);
			expect(opts.waitMax).toBe(WAIT_MAX_DEFAULT);
			expect(opts.factor).toBe(FACTOR_DEFAULT);
			expect(opts.linear).toBe(LINEAR_DEFAULT);
			expect(opts.random).toBe(RANDOM_DEFAULT);
			expect(opts.skipSameErrorCheck).toBe(SKIP_SAME_ERROR_CHECK_DEFAULT);
			expect(opts.waitIfNotConsumed).toBe(WAIT_IF_NOT_CONSUMED_DEFAULT);
			expect(opts.onCatch).toBe(ON_CATCH_DEFAULT);
			expect(opts.consumeIf).toBe(BOOL_FN_DEFAULT);
			expect(opts.retryIf).toBe(BOOL_FN_DEFAULT);
			expect(opts.concurrency).toBe(CONCURRENCY_DEFAULT);
			expect(opts.signal).toBe(null);
		});

		it("should allow overriding retries", () => {
			const opts = createInternalOptions({ retries: 10 });
			expect(opts.retries).toBe(10);
		});

		it("should allow overriding timeMax", () => {
			const opts = createInternalOptions({ timeMax: 5000 });
			expect(opts.timeMax).toBe(5000);
		});

		it("should allow overriding waitMin and waitMax", () => {
			const opts = createInternalOptions({ waitMin: 50, waitMax: 1000 });
			expect(opts.waitMin).toBe(50);
			expect(opts.waitMax).toBe(1000);
		});

		it("should allow overriding factor", () => {
			const opts = createInternalOptions({ factor: 3 });
			expect(opts.factor).toBe(3);
		});

		it("should allow overriding linear and random", () => {
			const opts = createInternalOptions({ linear: false, random: true });
			expect(opts.linear).toBe(false);
			expect(opts.random).toBe(true);
		});

		it("should allow overriding skipSameErrorCheck", () => {
			const opts = createInternalOptions({ skipSameErrorCheck: false });
			expect(opts.skipSameErrorCheck).toBe(false);
		});

		it("should allow overriding waitIfNotConsumed", () => {
			const opts = createInternalOptions({ waitIfNotConsumed: true });
			expect(opts.waitIfNotConsumed).toBe(true);
		});

		it("should allow overriding callback functions", () => {
			const onCatch = jest.fn();
			const consumeIf = jest.fn(() => false);
			const retryIf = jest.fn(() => true);

			const opts = createInternalOptions({ onCatch, consumeIf, retryIf });

			expect(opts.onCatch).toBe(onCatch);
			expect(opts.consumeIf).toBe(consumeIf);
			expect(opts.retryIf).toBe(retryIf);
		});

		it("should allow overriding signal", () => {
			const controller = new AbortController();
			const opts = createInternalOptions({ signal: controller.signal });
			expect(opts.signal).toBe(controller.signal);
		});

		it("should allow overriding concurrency", () => {
			const opts = createInternalOptions({ concurrency: 5 });
			expect(opts.concurrency).toBe(5);
		});

		it("should return frozen object", () => {
			const opts = createInternalOptions({});
			expect(Object.isFrozen(opts)).toBe(true);
		});

		it("should merge partial options with defaults", () => {
			const opts = createInternalOptions({
				retries: 10,
				waitMin: 200,
				linear: false
			});

			expect(opts.retries).toBe(10);
			expect(opts.waitMin).toBe(200);
			expect(opts.linear).toBe(false);
			// Defaults preserved
			expect(opts.waitMax).toBe(WAIT_MAX_DEFAULT);
			expect(opts.factor).toBe(FACTOR_DEFAULT);
		});
	});

	describe("validateOptions", () => {
		it("should validate retries must be >= 1", () => {
			const opts = createInternalOptions({ retries: 0 });
			expect(() => validateOptions(opts)).toThrow(RangeError);
			expect(() => validateOptions(opts)).toThrow("retries");
		});

		it("should allow infinite retries", () => {
			const opts = createInternalOptions({
				retries: Number.POSITIVE_INFINITY
			});
			expect(() => validateOptions(opts)).not.toThrow();
		});

		it("should validate waitMin cannot be negative", () => {
			const opts = createInternalOptions({ waitMin: -10 });
			expect(() => validateOptions(opts)).toThrow(RangeError);
		});

		it("should validate factor must be finite", () => {
			const opts = createInternalOptions({
				factor: Number.POSITIVE_INFINITY
			});
			expect(() => validateOptions(opts)).toThrow(RangeError);
			expect(() => validateOptions(opts)).toThrow("factor");
		});

		it("should validate concurrency must be >= 1", () => {
			const opts = createInternalOptions({ concurrency: 0 });
			expect(() => validateOptions(opts)).toThrow(RangeError);
			expect(() => validateOptions(opts)).toThrow("concurrency");
		});

		it("should validate concurrency must be finite", () => {
			const opts = createInternalOptions({
				concurrency: Number.POSITIVE_INFINITY
			});
			expect(() => validateOptions(opts)).toThrow(RangeError);
		});

		it("should pass validation with valid options", () => {
			const opts = createInternalOptions({
				retries: 5,
				waitMin: 100,
				waitMax: 5000,
				timeMax: 10000,
				factor: 2,
				concurrency: 3
			});

			expect(() => validateOptions(opts)).not.toThrow();
		});
	});
});

it("should validate waitMin cannot be greater than waitMax", () => {
	const opts = createInternalOptions({
		waitMin: 5000,
		waitMax: 1000
	});
	expect(() => validateOptions(opts)).toThrow(RangeError);
	expect(() => validateOptions(opts)).toThrow("waitMin");
	expect(() => validateOptions(opts)).toThrow("waitMax");
});

it("should allow waitMin > waitMax when waitMax is infinite", () => {
	const opts = createInternalOptions({
		waitMin: 5000,
		waitMax: Number.POSITIVE_INFINITY
	});
	expect(() => validateOptions(opts)).not.toThrow();
});

describe("edge cases with large numbers", () => {
	it("should handle MAX_SAFE_INTEGER for retries", () => {
		const opts = createInternalOptions({
			retries: Number.MAX_SAFE_INTEGER
		});
		expect(() => validateOptions(opts)).not.toThrow();
		expect(opts.retries).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("should handle very large waitMin values", () => {
		const opts = createInternalOptions({
			waitMin: Number.MAX_SAFE_INTEGER
		});
		expect(() => validateOptions(opts)).not.toThrow();
		expect(opts.waitMin).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("should handle very large factor values", () => {
		const opts = createInternalOptions({
			factor: 1000
		});
		expect(() => validateOptions(opts)).not.toThrow();
		expect(opts.factor).toBe(1000);
	});

	it("should reject NaN values", () => {
		const opts = createInternalOptions({
			retries: Number.NaN
		});
		expect(() => validateOptions(opts)).toThrow();
	});
});
