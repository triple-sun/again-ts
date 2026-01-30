/** Main fn type */
export type OnTryFunction<VALUE_TYPE = void> = (
	ctx: Readonly<RetryContext>,
	...args: unknown[]
) => Promise<VALUE_TYPE> | VALUE_TYPE;

/** Results */
export interface RetryFailedResult {
	readonly ok: false;
	readonly ctx: Readonly<RetryContext>;
}

export interface RetryOkResult<VALUE_TYPE> {
	readonly ok: true;
	readonly value: Awaited<VALUE_TYPE>;
	readonly ctx: Readonly<RetryContext>;
}

export type RetryResult<VALUE_TYPE> =
	| RetryOkResult<VALUE_TYPE>
	| RetryFailedResult;

/** Using object type for simplicity of extension in the future */
export interface RetryContext {
	errors: Error[];
	attempts: number;
	retriesTaken: number;
	readonly start: number;
	end: number;
}

/** Initial options object */
export interface RetryOptions {
	/**
	 * @description retry this amount of times (not including 1st attempt)
	 *  Infinity === try indefinetely
	 * @default RETRIES_DEFAULT
	 */
	retries?: number;

	/**
	 * @description limit execution time by ms
	 * @default TIME_MAX_DEFAULT
	 */
	readonly timeMax?: number;

	/**
	 * @description set min wait time between attempts
	 * overridden by time remaining
	 * @default WAIT_MIN_DEFAULT
	 */
	readonly waitMin?: number;

	/**
	 * @description max wait between attempts
	 * overrides waitMin if waitMax<waitMin
	 * @default WAIT_MAX_DEFAULT
	 */
	readonly waitMax?: number;

	/**
	 * @description multiply waitTime by exponent**triesConsumed
	 * @default FACTOR_DEFAULT
	 */
	readonly factor?: number;

	/**
	 * @description multply delay by attempt
	 * @default LINEAR_DEFAULT
	 */
	readonly linear?: boolean;

	/**
	 * @description randomize time between tries
	 * @default RANDOM_DEFAULT
	 */
	readonly random?: boolean;

	/**
	 * @description allow continuous saving of
	 * multiple instances of same error to ctx.errors
	 * @default SKIP_SAME_ERROR_CHECK_DEFAULT
	 */
	readonly skipSameErrorCheck?: boolean;

	/**
	 * @description allow continuous saving of
	 * multiple instances of same error to ctx.errors
	 * @default WAIT_IF_NOT_CONSUMED_DEFAULT
	 */
	readonly waitIfNotConsumed?: boolean;

	/**
	 * @description function to call on catch
	 * @default ON_CATCH_DEFAULT
	 */
	readonly onCatch?: (
		context: Readonly<RetryContext>
	) => Promise<unknown> | unknown;

	/**
	 * @description will not increment triesConsumed by 1
	 * if consumeIf() returns false or throws
	 * @default BOOL_FN_DEFAULT
	 */
	readonly consumeIf?: (
		context: Readonly<RetryContext>
	) => Promise<boolean> | boolean;

	/**
	 * @description will not retry if retryIf()
	 * returns false or throws
	 * @default BOOL_FN_DEFAULT
	 */
	readonly retryIf?: (
		context: Readonly<RetryContext>
	) => Promise<boolean> | boolean;

	/**
	 * You can use abort conroller to cancel execution
	 * {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController | AbortController}
	 */
	readonly signal?: Readonly<AbortSignal> | null;

	/**
	 * @description Number of concurrent executions per attempt
	 * Should be >0
	 * @default CONCURRENCY_DEFAULT
	 */
	readonly concurrency?: number;

	/**
	 * @description will be called after waiting
	 * @default () =>  null
	 */
	onTimeout?: (ctx: RetryContext) => void;
}

export type InternalRetryOptions = Readonly<Required<RetryOptions>>;
