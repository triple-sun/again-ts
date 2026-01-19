// biome-ignore lint/correctness/noUnusedImports: <used in TSDoc>
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
	WAIT_MAX_DEFAULT,
	WAIT_MIN_DEFAULT,
} from "./defaults";

/** Main fn type */
export type OnTryFunction<VALUE_TYPE = void> = (
	input: Readonly<RetryContext>,
	...args: unknown[]
) => Promise<VALUE_TYPE> | VALUE_TYPE;


/** Results */
export type RetryFailedResult = {
	readonly ok: false;
	readonly ctx: Readonly<RetryContext>;
};

export type RetryOkResult<VALUE_TYPE> = {
	readonly ok: true;
	readonly value: Awaited<VALUE_TYPE>;
	readonly ctx: Readonly<RetryContext>;
};

/** Using object type for simplicity of extension in the future */
export type RetryContext = {
	errors: Error[];
	attempts: number;
	triesConsumed: number;
	readonly start: number;
	end: number;
};

/** Initial options object */
export type RetryOptions = {
		/**
		 * try this amount of times (includint 1st attempt);
		 * Infinity === try until no error
		 * @default - @see TRIES_DEFAULT
		 */
		readonly tries?: number;
		/**
		 * NOT IMPLEMENTED
		 * @todo: implement :)
		 * set min execution time by ms
		 * @default - @see TIME_MIN_DEFAULT
		 */
		readonly timeMin?: number;
		/**
		 * limit execution time by ms
		 * @default - @see TIME_MAX_DEFAULT
		 */
		readonly timeMax?: number;
		/**
		 * set min wait time between attempts
		 * overridden by time remaining
		 * @default - @see WAIT_MIN_DEFAULT
		 */
		readonly waitMin?: number;
		/**
		 * max wait between attempts
		 * overrides waitMin if waitMax<waitMin
		 * @default - @see WAIT_MAX_DEFAULT
		 */
		readonly waitMax?: number;
		/**
		 * multiply waitTime by exponent**triesConsumed
		 * @default - @see FACTOR_DEFAULT
		 */
		readonly factor?: number;
		/**
		 * multply delay by attempt
		 * @default - @see LINEAR_DEFAULT
		 */
		readonly linear?: boolean;
		/**
		 * randomize time between tries
		 * @default - @see RANDOM_DEFAULT
		 */
		readonly random?: boolean;
		/**
		 * allow continuous saving of
		 * multiple instances of same error to ctx.errors
		 * @default - @see SKIP_SAME_ERROR_CHECK_DEFAULT
		 */
		readonly skipSameErrorCheck?: boolean;
		/**
		 * allow continuous saving of
		 * multiple instances of same error to ctx.errors
		 * @default - @see SKIP_SAME_ERROR_CHECK_DEFAULT
		 */
		readonly waitIfNotConsumed?: boolean;
		/**
		 * function to call on catch
		 * @default - @see ON_CATCH_DEFAULT
		 */
		readonly onCatch?: (context: Readonly<RetryContext>) => Promise<unknown> | unknown;
		/**
		 * will not increment triesConsumed by 1
		 * if consumeIf() returns false or throws
		 * @default - @see BOOL_FN_DEFAULT
		 */
		readonly consumeIf?: (context: Readonly<RetryContext>) => Promise<boolean> | boolean;
		/**
		 * will not retry if retryIf()
		 * returns false or throws
		 * @default - @see BOOL_FN_DEFAULT
		 */
		readonly retryIf?: (context: Readonly<RetryContext>) => Promise<boolean> | boolean;
		/**
		 * You can use abort conroller to cancel execution
		 * {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController | AbortController}
		 */
		readonly signal?: Readonly<AbortSignal> | null;
		/**
		 * Number of concurrent executions per attempt
		 * Should be >0
		 * @default CONCURRENCY_DEFAULT
		 */
		readonly concurrency?: number;
	};