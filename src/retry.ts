import type {
	RetryContext,
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
	SealedOptions,
} from "./types";
import {
	getWaitTime,
	handleError,
	handleTimeLimit,
	handleTries,
	handleWait,
	validateNumericOption,
} from "./utils";

/**
 * @param onTry - main function to be retried
 * @param options - @see RetryOptions
 * @returns @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <Result>(
	onTry: (att: number, ...args: unknown[]) => Promise<Result> | Result,
	options: RetryOptions = {},
): Promise<RetryOkResult<Result> | RetryFailedResult> => {
	/** prevent option mutation */
	const o: SealedOptions = {
		tries: options.tries ?? 5,
		timeLimit: options.timeLimit ?? Number.POSITIVE_INFINITY,
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
	});
	validateNumericOption("waitMin", o.waitMin, {
		finite: true,
	});
	validateNumericOption("waitMax", o.waitMax, {
		finite: false,
	});
	validateNumericOption("timeLimit", o.timeLimit, {
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
		triesLeft: 0,
		start: performance.now(),
		end: performance.now(),
	};

	while (!Number.isFinite(o.tries) || c.triesConsumed < o.tries) {
		c.attempts++;

		try {
			return {
				ok: true,
				value: await onTry(c.attempts),
				context: { ...c, end: performance.now() },
			};
		} catch (e) {
			try {
				const error = handleError(e, c, o);

				o.signal?.throwIfAborted();
				handleTries(error, c, o);

				o.signal?.throwIfAborted();
				const timeRemaining = handleTimeLimit(error, c.start, o.timeLimit);

				o.signal?.throwIfAborted();
				await o.onCatch(c);

				o.signal?.throwIfAborted();
				if (!(await o.consumeIf(c))) continue;
				if (!(await o.retryIf(c))) throw error;

				o.signal?.throwIfAborted();
				const waitTime = getWaitTime(timeRemaining, c.triesConsumed, o);

				o.signal?.throwIfAborted();
				await handleWait(waitTime, o.signal);

				c.triesConsumed++;
			} catch (e) {
				console.error("caught", e);
				handleError(e, c, o);
				break;
			}
		}
	}

	return { ok: false, context: { ...c, end: performance.now() } };
};

export const retryify = <Arguments extends unknown[], Result>(
	function_: (...arguments_: Arguments) => Promise<Result> | Result,
	options: RetryOptions,
): ((
	...arguments_: Arguments
) => Promise<RetryFailedResult | RetryOkResult<Result>>) => {
	return (...arguments_) => {
		return retry(() => function_.apply(this, arguments_), options);
	};
};
