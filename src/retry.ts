import {
	BOOL_FN_DEFAULT,
	CONCURRENCY_DEFAULT,
	FACTOR_DEFAULT,
	LINEAR_DEFAULT,
	ON_CATCH_DEFAULT,
	RANDOM_DEFAULT,
	SKIP_SAME_ERROR_CHECK_DEFAULT,
	TIME_MAX_DEFAULT,
	TIME_MIN_DEFAULT,
	TRIES_DEFAULT,
	WAIT_IF_NOT_CONSUMED_DEFAULT,
	WAIT_MAX_DEFAULT,
	WAIT_MIN_DEFAULT,
} from "./defaults";
import { ErrorTypeError, StopRetryError } from "./errors";
import type {
	OnTryFunction,
	RetryContext,
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
} from "./types";
import {
	getError,
	getTimeRemaining,
	getTriesLeft,
	getWaitTime,
	saveErrorsToCtx,
	tryBoolFn,
	validateNumericOption,
} from "./utils";

const { now } = performance;

/**
 * @param onTry - main function to be retried
 * @param o - @see RetryOptions
 * @returns - @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	options: RetryOptions = {},
): Promise<RetryOkResult<VALUE_TYPE> | RetryFailedResult> => {
	const opts: Readonly<Required<RetryOptions>> = {
		tries: TRIES_DEFAULT,
		timeMin: TIME_MIN_DEFAULT,
		timeMax: TIME_MAX_DEFAULT,
		waitMin: WAIT_MIN_DEFAULT,
		waitMax: WAIT_MAX_DEFAULT,
		factor: FACTOR_DEFAULT,
		linear: LINEAR_DEFAULT,
		random: RANDOM_DEFAULT,
		skipSameErrorCheck: SKIP_SAME_ERROR_CHECK_DEFAULT,
		waitIfNotConsumed: WAIT_IF_NOT_CONSUMED_DEFAULT,
		onCatch: ON_CATCH_DEFAULT,
		consumeIf: BOOL_FN_DEFAULT,
		retryIf: BOOL_FN_DEFAULT,
		concurrency: CONCURRENCY_DEFAULT,
		signal: null,
		...options,
	};

	/** prevent option mutation */
	Object.freeze(opts);

	/** validate options */
	validateNumericOption("tries", opts.tries, {
		finite: false,
		min: 1,
	});
	validateNumericOption("waitMin", opts.waitMin, {
		finite: true,
	});
	validateNumericOption("waitMax", opts.waitMax, {
		finite: false,
	});
	validateNumericOption("timeMax", opts.timeMax, {
		finite: false,
	});
	validateNumericOption("factor", opts.factor, {
		finite: true,
	});
	validateNumericOption("concurrency", opts.concurrency, {
		finite: true,
		min: 1,
	});

	/** mutable context object */
	const ctx: RetryContext = {
		errors: [],
		attempts: 0,
		triesConsumed: 0,
		start: now(),
		end: now(),
	};

	while (!Number.isFinite(opts.tries) || ctx.triesConsumed < opts.tries) {
		ctx.attempts++;

		try {
			opts.signal?.throwIfAborted();
			const value = await Promise.any(
				Array.from({ length: opts.concurrency }, async () => await onTry(ctx)),
			);

			opts.signal?.throwIfAborted();
			return {
				ok: true,
				value,
				ctx: { ...ctx, end: performance.now() },
			};
		} catch (onTryErr) {
			/** try so we can abort by throwing errors */
			try {
				const err = getError(onTryErr);

				/** save error first so retryIf/consumeIf errors come later */
				saveErrorsToCtx(err, ctx.errors, opts);

				/** stop if we receive stop retry error */
				const stopError = ctx.errors.find((e) => e instanceof StopRetryError);
				if (stopError) throw stopError.original;

				opts.signal?.throwIfAborted();
				const triesLeft = getTriesLeft(ctx, opts.tries);

				opts.signal?.throwIfAborted();
				const timeRemaining = getTimeRemaining(ctx.start, opts.timeMax, now());

				opts.signal?.throwIfAborted();
				await opts.onCatch(ctx);

				opts.signal?.throwIfAborted();
				const shouldConsume = await tryBoolFn(opts.consumeIf, ctx, opts);

				/** handle time and tries limits */
				if (timeRemaining <= 0 || triesLeft <= 0) throw err;

				/** stop if we receive error type error */
				const typeError = ctx.errors.find((e) => e instanceof ErrorTypeError);
				if (typeError) {
					if (shouldConsume) throw typeError;
					opts.signal?.throwIfAborted();
					continue;
				}

				/** cal */
				opts.signal?.throwIfAborted();
				if (!(await tryBoolFn(opts.retryIf, ctx, opts))) {
					throw ctx.errors[ctx.errors.length - 1];
				}

				/** do not counsume or delay if shouldn't */
				opts.signal?.throwIfAborted();
				if (!shouldConsume && !opts.waitIfNotConsumed) continue;

				/** get wait time */
				opts.signal?.throwIfAborted();
				const waitTime = getWaitTime(opts, timeRemaining, ctx.triesConsumed);

				opts.signal?.throwIfAborted();
				if (waitTime > 0) {
					let timeout: NodeJS.Timeout;
					await new Promise<void>((resolve, reject) => {
						const onAbort = () => {
							clearTimeout(timeout);
							opts.signal?.removeEventListener("abort", onAbort);
							reject(opts.signal?.reason);
						};

						timeout = setTimeout(() => {
							opts.signal?.removeEventListener("abort", onAbort);
							resolve();
						}, waitTime);

						opts.signal?.addEventListener("abort", onAbort, { once: true });

						return timeout;
					}).finally(() => {
						timeout?.unref();
					});
				}

				if (shouldConsume) ctx.triesConsumed++;
			} catch (_) {
				break;
			}
		}
	}

	return { ok: false, ctx: { ...ctx, end: now() } };
};
