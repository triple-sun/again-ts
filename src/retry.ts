import type {
	RetryContext,
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
} from "./types";
import { onFail, validateNumericOption, validateTries } from "./utils";

/**
 * @param onTry - main callback
 * @param options.tries - tries; 0 === try until no error
 * @param options.delay - delay between attempts
 * @param options.exponential - use wait(delay*attempt) instead of wait(delay)
 * @param options.onCatch - callback to call on every catch
 * @returns @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <Result>(
	onTry: (att: number, ...args: unknown[]) => Promise<Result> | Result,
	options: RetryOptions = {},
): Promise<RetryOkResult<Result> | RetryFailedResult> => {
	options.tries ??= 5;
	options.delay ??= 100;
	options.exponent ??= 1;
	options.limit ??= Number.POSITIVE_INFINITY;
	options.skipSameErrorCheck ??= false;

	validateTries(options.tries);
	validateNumericOption("delay", options.delay, { finite: true });
	validateNumericOption("limit", options.limit, { finite: false });
	validateNumericOption("exponent", options.exponent, { finite: true });

	const context: RetryContext = {
		errors: [],
		attempt: 0,
		triesConsumed: 0,
		triesLeft: 0,
		start: performance.now(),
	};

	while (Number.isFinite(options.tries) || context.attempt < options.tries) {
		context.attempt++;

		try {
			const result = await onTry(context.attempt);
			return {
				ok: true,
				value: result,
				context: { ...context, end: performance.now() },
			};
		} catch (error) {
			onFail(error, context, options);
		}
	}

	return { ok: false, context: { ...context, end: performance.now() } };
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
