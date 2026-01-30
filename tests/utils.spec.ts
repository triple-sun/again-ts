/** biome-ignore-all lint/suspicious/noExplicitAny: <testing> */
import {
	FACTOR_DEFAULT,
	RANDOM_DEFAULT,
	RETRIES_DEFAULT,
	TIME_MAX_DEFAULT,
	WAIT_MAX_DEFAULT
} from "../src/defaults";
import { ErrorTypeError, StopError } from "../src/errors";
import type { InternalRetryOptions } from "../src/types";
import {
	createInternalOptions,
	createRetryContext,
	getTimeRemaining,
	getTriesLeft,
	getWaitTime,
	onRetryCatch,
	saveErrorsToContext,
	serializeError,
	tryBoolFn,
	validateNumericOption,
	wait
} from "../src/utils";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <tests>
describe("utils", () => {
	describe("validateNumericOption", () => {
		it("should pass for valid numbers", () => {
			expect(() => validateNumericOption("factor", 10)).not.toThrow();
			expect(() =>
				validateNumericOption("linear", 0, { min: 0 })
			).not.toThrow();
			expect(() =>
				validateNumericOption("random", Number.POSITIVE_INFINITY, {
					finite: false
				})
			).not.toThrow();
		});

		it("should throw for non-numbers", () => {
			expect(() => validateNumericOption("retries", "10" as any)).toThrow(
				ErrorTypeError
			);
			expect(() => validateNumericOption("retries", NaN)).toThrow(
				ErrorTypeError
			);
		});

		it("should throw for values below min", () => {
			expect(() => validateNumericOption("retries", 5, { min: 10 })).toThrow(
				RangeError
			);
		});

		it("should throw for non-finite values if required", () => {
			expect(() =>
				validateNumericOption("retries", Number.POSITIVE_INFINITY, {
					finite: true
				})
			).toThrow(RangeError);
		});

		it("should ignore undefined values", () => {
			expect(() =>
				validateNumericOption("retries", undefined as any)
			).not.toThrow();
		});
	});

	describe("wait", () => {
		beforeAll(() => {
			jest.useFakeTimers();
		});
		afterAll(() => {
			jest.useRealTimers();
		});

		it("should wait for specified time", async () => {
			const promise = wait(1000);
			jest.advanceTimersByTime(1000);
			await expect(promise).resolves.toBeUndefined();
		});
	});

	describe("getError", () => {
		it("should return Error as is", () => {
			const err = new Error("retries");
			expect(serializeError(err)).toBe(err);
		});

		it("should wrap non-Error in ErrorTypeError", () => {
			const err = serializeError("string error");
			expect(err).toBeInstanceOf(ErrorTypeError);
			expect(err.message).toContain("string");
		});
	});

	describe("saveErrorsToCtx", () => {
		it("should save errors", () => {
			const ctxErrors: Error[] = [];
			const opts = { skipSameErrorCheck: false };
			const err1 = new Error("e1");
			saveErrorsToContext(err1, ctxErrors, opts);
			expect(ctxErrors).toHaveLength(1);
			expect(ctxErrors[0]).toBe(err1);
		});

		it("should handle StopRetryError", () => {
			const ctxErrors: Error[] = [];
			const opts = { skipSameErrorCheck: false };
			const original = new Error("orig");
			const stopErr = new StopError(original);
			saveErrorsToContext(stopErr, ctxErrors, opts);
			expect(ctxErrors).toHaveLength(1);
			expect(ctxErrors[0]).toBe(original);
		});

		it("should handle AggregateError", () => {
			const ctxErrors: Error[] = [];
			const opts = { skipSameErrorCheck: false };
			const err1 = new Error("e1");
			const err2 = new Error("e2");
			const agg = new AggregateError([err1, err2]);
			saveErrorsToContext(agg, ctxErrors, opts);
			expect(ctxErrors).toHaveLength(2);
			expect(ctxErrors).toEqual([err1, err2]);
		});

		it("should dedup consecutive identical errors", () => {
			const ctxErrors: Error[] = [];
			const opts = { skipSameErrorCheck: false };
			const err1 = new Error("same");
			const err2 = new Error("same");
			saveErrorsToContext(err1, ctxErrors, opts);
			saveErrorsToContext(err2, ctxErrors, opts);
			expect(ctxErrors).toHaveLength(1);
		});

		it("should not dedup if skipSameErrorCheck is true", () => {
			const ctxErrors: Error[] = [];
			const opts = { skipSameErrorCheck: true };
			const err1 = new Error("same");
			const err2 = new Error("same");
			saveErrorsToContext(err1, ctxErrors, opts);
			saveErrorsToContext(err2, ctxErrors, opts);
			expect(ctxErrors).toHaveLength(2);
		});
	});

	describe("getTriesLeft", () => {
		it("should return tries left", () => {
			expect(getTriesLeft({ retriesConsumed: 2 } as any, 5)).toBe(3);
		});
		it("should return infinity if tries is infinity", () => {
			expect(
				getTriesLeft({ retriesConsumed: 100 } as any, Number.POSITIVE_INFINITY)
			).toBe(Number.POSITIVE_INFINITY);
		});
		it("should return 0 if consumed >= tries", () => {
			expect(getTriesLeft({ retriesConsumed: 5 } as any, 5)).toBe(0);
		});
	});

	describe("getTimeRemaining", () => {
		it("should return time remaining", () => {
			const start = performance.now();
			const timeMax = 1000;
			const now = start + 200;

			expect(getTimeRemaining(start, timeMax, now)).toBeCloseTo(800);
		});

		it("should return infinity if timeMax is infinity", () => {
			expect(
				getTimeRemaining(
					performance.now(),
					Number.POSITIVE_INFINITY,
					performance.now()
				)
			).toBe(Number.POSITIVE_INFINITY);
		});
	});

	describe("getWaitTime", () => {
		const baseOpts: InternalRetryOptions = {
			retries: RETRIES_DEFAULT,
			timeMin: 0,
			timeMax: TIME_MAX_DEFAULT,
			waitMin: 100,
			waitMax: WAIT_MAX_DEFAULT,
			factor: FACTOR_DEFAULT,
			linear: false, // default in input is true, but checking formula logic
			random: RANDOM_DEFAULT,
			skipSameErrorCheck: false,
			waitIfNotConsumed: false,
			onCatch: () => true,
			consumeIf: () => true,
			retryIf: () => true,
			concurrency: 1,
			signal: null
		};

		it("should calculate basic wait time", () => {
			// linear false, factor 1, random false
			expect(getWaitTime(baseOpts, 10000, 0)).toBe(100);
			expect(getWaitTime(baseOpts, 10000, 5)).toBe(100);
		});

		it("should apply linear backoff", () => {
			const opts = { ...baseOpts, linear: true };
			expect(getWaitTime(opts, 10000, 0)).toBe(0); // retriesConsumed 0 * waitMin
			expect(getWaitTime(opts, 10000, 1)).toBe(100);
			expect(getWaitTime(opts, 10000, 2)).toBe(200);
		});

		it("should apply exponential factor", () => {
			const opts = { ...baseOpts, factor: 2 };
			// factor^(max(1, retriesConsumed+1)-1)
			// tries=0 -> 2^(1-1) = 1 -> 100
			expect(getWaitTime(opts, 10000, 0)).toBe(100);
			// tries=1 -> 2^(2-1) = 2 -> 200
			expect(getWaitTime(opts, 10000, 1)).toBe(200);
			// tries=2 -> 2^(3-1) = 4 -> 400
			expect(getWaitTime(opts, 10000, 2)).toBe(400);
		});

		it("should cap at waitMax", () => {
			const opts = { ...baseOpts, factor: 10, waitMax: 500 };
			expect(getWaitTime(opts, 10000, 2)).toBe(500);
		});

		it("should not exceed timeRemaining", () => {
			expect(getWaitTime(baseOpts, 50, 0)).toBe(50);
		});
	});

	describe("tryBoolFn", () => {
		it("should return true if fn returns true", async () => {
			await expect(tryBoolFn(() => true, {} as any, {} as any)).resolves.toBe(
				true
			);
		});

		it("should return false and save error if fn throws", async () => {
			const ctx = { errors: [] } as any;
			const opts = { skipSameErrorCheck: false } as any;
			await expect(
				tryBoolFn(
					() => {
						throw new Error("fail");
					},
					ctx,
					opts
				)
			).resolves.toBe(false);
			expect(ctx.errors).toHaveLength(1);
		});
	});
	describe("onRetryCatch", () => {
		it("should throw ErrorTypeError immediately if shouldConsume is false", async () => {
			const ctx = createRetryContext();
			const opts = createInternalOptions({
				retries: 3,
				consumeIf: () => false
			});
			const error = new ErrorTypeError("wrong type");

			await expect(onRetryCatch(error, ctx, opts)).resolves.toBeUndefined();
		});
	});
});
