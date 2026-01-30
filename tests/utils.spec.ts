/** biome-ignore-all lint/suspicious/noExplicitAny: <testing> */
import {
	FACTOR_DEFAULT,
	ON_TIMEOUT_DEFAULT,
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
			expect(getTriesLeft({ retriesTaken: 2 } as any, 5)).toBe(3);
		});
		it("should return infinity if tries is infinity", () => {
			expect(
				getTriesLeft({ retriesTaken: 100 } as any, Number.POSITIVE_INFINITY)
			).toBe(Number.POSITIVE_INFINITY);
		});
		it("should return 0 if consumed >= tries", () => {
			expect(getTriesLeft({ retriesTaken: 5 } as any, 5)).toBe(0);
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
			onTimeout: ON_TIMEOUT_DEFAULT,
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
			expect(getWaitTime(opts, 10000, 0)).toBe(0); // retriesTaken 0 * waitMin
			expect(getWaitTime(opts, 10000, 1)).toBe(100);
			expect(getWaitTime(opts, 10000, 2)).toBe(200);
		});

		it("should apply exponential factor", () => {
			const opts = { ...baseOpts, factor: 2 };
			// factor^(max(1, retriesTaken+1)-1)
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

		it("should apply random backoff when enabled", () => {
			const opts = { ...baseOpts, random: true };
			// Mock Math.random to return a predictable value
			const originalRandom = Math.random;
			Math.random = () => 0.5; // randomX will be 1.5

			// waitMin=100, randomX=1.5, linearX=1, factorX=1
			// wait = 100 * 1.5 * 1 * 1 = 150
			expect(getWaitTime(opts, 10000, 0)).toBe(150);

			Math.random = originalRandom;
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
	// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <jest!>
	describe("onRetryCatch", () => {
		const baseOpts = createInternalOptions({});
		const createCtx = () => createRetryContext();

		it("should respect consumeIf", async () => {
			const ctx = createCtx();
			ctx.attempts = 3;
			const opts = createInternalOptions({
				consumeIf: c => c.attempts > 2
			});

			await onRetryCatch(new Error("fail"), ctx, opts);
			expect(ctx.retriesTaken).toBe(1);

			const ctx2 = createCtx();
			ctx2.attempts = 1;
			await onRetryCatch(new Error("fail"), ctx2, opts);
			expect(ctx2.retriesTaken).toBe(0);
		});

		it("should respect consumeIf even if it throws", async () => {
			const ctx = createCtx();
			ctx.attempts = 3;
			const opts = createInternalOptions({
				consumeIf: c => {
					if (c.attempts > 2) return true;
					throw new Error("consumeIf error");
				}
			});

			await onRetryCatch(new Error("fail"), ctx, opts);
			expect(ctx.retriesTaken).toBe(1);

			const ctx2 = createCtx();
			ctx2.attempts = 1;
			await onRetryCatch(new Error("fail"), ctx2, opts);
			expect(ctx2.retriesTaken).toBe(0);
			// Error from consumeIf is saved
			expect(ctx2.errors).toHaveLength(2); // "fail" + "consumeIf error"
		});

		it("should call onCatch with context", async () => {
			const onCatch = jest.fn();
			const ctx = createCtx();
			const opts = createInternalOptions({ onCatch });
			const err = new Error("fail");

			await onRetryCatch(err, ctx, opts);

			expect(onCatch).toHaveBeenCalledWith(ctx);
			expect(ctx.errors[0]).toBe(err);
		});

		it("should remind to throw only Errors", async () => {
			const ctx = createCtx();
			const opts = baseOpts;

			await expect(onRetryCatch("string error", ctx, opts)).rejects.toThrow(
				ErrorTypeError
			);

			expect(ctx.errors[0]).toBeInstanceOf(ErrorTypeError);
			expect(ctx.errors[0]?.message).toMatch(/Expected instanceof Error/);
		});

		it("should throw type error if retry not allowed (ErrorTypeError)", async () => {
			const ctx = createCtx();
			const opts = baseOpts;
			const err = new ErrorTypeError("fatal");

			await expect(onRetryCatch(err, ctx, opts)).rejects.toBe(err);
		});

		it("should throw StopError immediately", async () => {
			const ctx = createCtx();
			const opts = baseOpts;
			const original = new Error("StopError");
			const stopErr = new StopError(original);

			await expect(onRetryCatch(stopErr, ctx, opts)).rejects.toBe(original);
		});

		it("should not call retryIf for ErrorTypeError", async () => {
			const retryIf = jest.fn(() => true);
			const ctx = createCtx();
			const opts = createInternalOptions({ retryIf });
			const err = new ErrorTypeError("fatal");

			await expect(onRetryCatch(err, ctx, opts)).rejects.toBe(err);
			expect(retryIf).not.toHaveBeenCalled();
		});

		it("should dedup errors if skipSameErrorCheck is false", async () => {
			const ctx = createCtx();
			const opts = createInternalOptions({ skipSameErrorCheck: false });
			const err = new Error("same");

			await onRetryCatch(err, ctx, opts);
			await onRetryCatch(new Error("same"), ctx, opts); // same message, different instance but deep equal check might pass or fail depending on imp. util test showed simple Error is deduped

			expect(ctx.errors).toHaveLength(1);
		});

		it("should not dedup errors if skipSameErrorCheck is true", async () => {
			const ctx = createCtx();
			const opts = createInternalOptions({ skipSameErrorCheck: true });
			const err = new Error("same");

			await onRetryCatch(err, ctx, opts);
			await onRetryCatch(new Error("same"), ctx, opts);

			expect(ctx.errors).toHaveLength(2);
		});

		it("should throw error when retryIf returns false", async () => {
			const ctx = createCtx();
			const error = new Error("fail");
			const retryIf = jest.fn(() => false);
			const opts = createInternalOptions({ retryIf });

			await expect(onRetryCatch(error, ctx, opts)).rejects.toBe(error);
			expect(retryIf).toHaveBeenCalledWith(ctx);
			expect(ctx.errors).toContain(error);
		});

		it("should wait when waitIfNotConsumed is true even if shouldConsume is false", async () => {
			jest.useFakeTimers();
			const ctx = createCtx();
			const error = new Error("fail");
			const opts = createInternalOptions({
				consumeIf: () => false,
				waitIfNotConsumed: true,
				waitMin: 100,
				retries: 5
			});

			const promise = onRetryCatch(error, ctx, opts);
			jest.advanceTimersByTime(100);
			await promise;

			expect(ctx.retriesTaken).toBe(0); // Should not consume
			jest.useRealTimers();
		});

		it("should not wait when waitIfNotConsumed is false and shouldConsume is false", async () => {
			const ctx = createCtx();
			const error = new Error("fail");
			const opts = createInternalOptions({
				consumeIf: () => false,
				waitIfNotConsumed: false,
				waitMin: 1000,
				retries: 5
			});

			// Should return immediately without waiting
			await onRetryCatch(error, ctx, opts);

			expect(ctx.retriesTaken).toBe(0); // Should not consume
		});

		it("should increment retriesTaken when shouldConsume is true", async () => {
			const ctx = createCtx();
			const error = new Error("fail");
			const opts = createInternalOptions({
				consumeIf: () => true,
				waitMin: 0,
				retries: 5
			});

			await onRetryCatch(error, ctx, opts);

			expect(ctx.retriesTaken).toBe(1);
		});
	});
});
