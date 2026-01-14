import { ErrorTypeError } from "./errors";
import type {
	OnTryFunction,
	RetryContext,
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
	SealedRetryOptions,
} from "./types";
import {
	getTimeRemaining,
	getTriesLeft,
	getWaitTime,
	handleError,
	handleWaitTime,
	validateNumericOption,
} from "./utils";

/**
 * @param onTry - main function to be retried
 * @param options - @see RetryOptions
 * @returns @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	options: Readonly<RetryOptions> = {},
): Promise<RetryOkResult<VALUE_TYPE> | RetryFailedResult> => {
	/** prevent option mutation */
	const o: SealedRetryOptions = {
		tries: options.tries ?? 5,
		timeMin: 0,
		timeMax: options.timeMax ?? Number.POSITIVE_INFINITY,
		waitMin: options.waitMin ?? 1000,
		waitMax: options.waitMax ?? Number.POSITIVE_INFINITY,
		factor: options.factor ?? 1,
		linear: options.linear ?? false,
		random: false,
		skipSameErrorCheck: options.skipSameErrorCheck || false,
		onCatch: options.onCatch ?? (() => {}),
		consumeIf: options.consumeIf ?? (() => true),
		retryIf: options.retryIf ?? (() => true),
		signal: options.signal || null,
	};

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
				context: { ...c, end: performance.now() },
			};
		} catch (tryError) {
			try {
				const e = handleError(tryError, c, o);

				o.signal?.throwIfAborted();
				const triesLeft = getTriesLeft(c, o);

				o.signal?.throwIfAborted();
				const timeRemaining = getTimeRemaining(c.start, o.timeMax);

				o.signal?.throwIfAborted();
				await o.onCatch(c);

				if (timeRemaining <= 0 || triesLeft <= 0) {
					throw e;
				}

				if (e instanceof ErrorTypeError) {
					if (await o.consumeIf(c)) {
						throw e;
					}

					options.signal?.throwIfAborted();
					continue;
				}

				o.signal?.throwIfAborted();
				if (!(await o.retryIf(c))) {
					throw e;
				}

				o.signal?.throwIfAborted();
				if (!(await o.consumeIf(c))) {
					continue;
				}

				o.signal?.throwIfAborted();
				const waitTime = getWaitTime(timeRemaining, c.triesConsumed, o);

				o.signal?.throwIfAborted();
				await handleWaitTime(waitTime, o.signal);

				c.triesConsumed++;
			} catch (lastError) {
				handleError(lastError, c, o);
				break;
			}
		}
	}

	return { ok: false, context: { ...c, end: performance.now() } };
};
