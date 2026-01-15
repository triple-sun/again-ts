import {
	BOOL_FN_DEFAULT,
	FACTOR_DEFAULT,
	LINEAR_DEFAULT,
	ON_CATCH_DEFAULT,
	RANDOM_DEFAULT,
	SKIP_SAME_ERROR_DEFAULT,
	TIME_MAX_DEFAULT,
	TIME_MIN_DEFAULT,
	TRIES_DEFAULT,
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
	saveErrorToCtx,
	tryBoolFn,
	validateNumericOption,
} from "./utils";

/**
 * @param onTry - main function to be retried
 * @param o - @see RetryOptions
 * @returns - @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	o: RetryOptions = {},
): Promise<RetryOkResult<VALUE_TYPE> | RetryFailedResult> => {
	o.tries ??= TRIES_DEFAULT;
	o.timeMin ??= TIME_MIN_DEFAULT;
	o.timeMax ??= TIME_MAX_DEFAULT;
	o.waitMin ??= WAIT_MIN_DEFAULT;
	o.waitMax ??= WAIT_MAX_DEFAULT;
	o.factor ??= FACTOR_DEFAULT;
	o.linear ??= LINEAR_DEFAULT;
	o.random ??= RANDOM_DEFAULT;
	o.skipSameErrorCheck ??= SKIP_SAME_ERROR_DEFAULT;
	o.onCatch ??= ON_CATCH_DEFAULT;
	o.consumeIf ??= BOOL_FN_DEFAULT;
	o.retryIf ??= BOOL_FN_DEFAULT;

	/** prevent option mutation */
	Object.freeze(o);

	/** validate options */
	validateNumericOption("tries", o.tries, {
		finite: false,
		min: 1,
	});
	validateNumericOption("waitMin", o.waitMin, {
		finite: true,
	});
	validateNumericOption("waitMax", o.waitMax, {
		finite: false,
	});
	validateNumericOption("timeLimit", o.timeMax, {
		finite: false,
	});
	validateNumericOption("factor", o.factor, {
		finite: true,
	});

	/** mutable context object */
	const c: RetryContext = {
		errors: [],
		attempts: 0,
		triesConsumed: 0,
		start: performance.now(),
		end: performance.now(),
	};

	while (!Number.isFinite(o.tries) || c.triesConsumed < o.tries) {
		c.attempts++;

		try {
			o.signal?.throwIfAborted();
			const value = await onTry(c);

			o.signal?.throwIfAborted();
			return {
				ok: true,
				value,
				ctx: { ...c, end: performance.now() },
			};
		} catch (onTryErr) {
			/** try so we can abort by throwing errors */
			try {
				const e = getError(onTryErr);

				/** save error first so retryIf/consumeIf errors come later */
				saveErrorToCtx(e, c, o);

				if (e instanceof StopRetryError) {
					throw e.original;
				}

				o.signal?.throwIfAborted();
				const triesLeft = getTriesLeft(c, o.tries);

				o.signal?.throwIfAborted();
				const timeRemaining = getTimeRemaining(c.start, o.timeMax);

				o.signal?.throwIfAborted();
				await o.onCatch(c);

				o.signal?.throwIfAborted();
				const shouldConsume = await tryBoolFn(o.consumeIf, c, o);

				if (timeRemaining <= 0 || triesLeft <= 0) {
					throw e;
				}

				if (e instanceof ErrorTypeError) {
					if (shouldConsume) {
						throw e;
					}

					o.signal?.throwIfAborted();
					continue;
				}

				o.signal?.throwIfAborted();
				if (!(await tryBoolFn(o.retryIf, c, o))) {
					throw c.errors[c.errors.length - 1];
				}

				o.signal?.throwIfAborted();
				if (!shouldConsume) {
					continue;
				}

				o.signal?.throwIfAborted();
				const waitTime = getWaitTime(timeRemaining, c.triesConsumed, o);

				o.signal?.throwIfAborted();
				if (waitTime > 0) {
					await new Promise<void>((resolve, reject) => {
						const onAbort = () => {
							clearTimeout(timeoutToken);
							o.signal?.removeEventListener("abort", onAbort);
							reject(o.signal?.reason);
						};

						const timeoutToken = setTimeout(() => {
							o.signal?.removeEventListener("abort", onAbort);
							resolve();
						}, waitTime);

						o.signal?.addEventListener("abort", onAbort, { once: true });

						return timeoutToken;
					});
				}

				c.triesConsumed++;
			} catch (_breakError) {
				break;
			}
		}
	}

	return { ok: false, ctx: { ...c, end: performance.now() } };
};
