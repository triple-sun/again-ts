/** biome-ignore-all lint/correctness/noUnusedImports: <used in TSDoc> */
// biome-ignore assist/source/organizeImports: <used in TSDoc>
import {
	TRIES_DEFAULT,
	TIME_MAX_DEFAULT,
	TIME_MIN_DEFAULT,
	WAIT_MAX_DEFAULT,
	WAIT_MIN_DEFAULT,
	FACTOR_DEFAULT,
	LINEAR_DEFAULT,
	RANDOM_DEFAULT,
	SKIP_SAME_ERROR_DEFAULT,
	ON_CATCH_DEFAULT,
	BOOL_FN_DEFAULT,
} from "./defaults";

/** Main fn type */
export type OnTryFunction<VALUE_TYPE = void> = (
	input: RetryContext,
	...args: unknown[]
) => Promise<VALUE_TYPE> | VALUE_TYPE;

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
		tries?: number;
		/**
		 * NOT IMPLEMENTED
		 * @todo: implement :)
		 * set min execution time by ms
		 * @default - @see TIME_MIN_DEFAULT
		 */
		timeMin?: number;
		/**
		 * limit execution time by ms
		 * @default - @see TIME_MAX_DEFAULT
		 */
		timeMax?: number;
		/**
		 * set min wait time between attempts
		 * overridden by time remaining
		 * @default - @see WAIT_MIN_DEFAULT
		 */
		waitMin?: number;
		/**
		 * max wait between attempts
		 * overrides waitMin if waitMax<waitMin
		 * @default - @see WAIT_MAX_DEFAULT
		 */
		waitMax?: number;
		/** 
		 * multiply waitTime by exponent**triesConsumed 
		 * @default - @see FACTOR_DEFAULT
		 */
		factor?: number;
		/** 
		 * multply delay by attempt 
		 * @default - @see LINEAR_DEFAULT
		*/
		linear?: boolean 
		 /** 
		  * randomize time between tries 
		  * @default - @see RANDOM_DEFAULT 
		  */
		random?: boolean;
		/** 
		 * allow continuous saving of 
		 * multiple instances of same error to ctx.errors
		 * @default - @see SKIP_SAME_ERROR_DEFAULT
		 */
		skipSameErrorCheck?: boolean ;
		/** 
		 * function to call on catch 
		 * @default - @see ON_CATCH_DEFAULT 
		 */
		onCatch?: (context: RetryContext) => Promise<unknown> | unknown;
		/** 
		 * will not increment triesConsumed by 1 
		 * if consumeIf() returns false or throws  
		 * @default - @see BOOL_FN_DEFAULT
		 */
		consumeIf?: (context: RetryContext) => Promise<boolean> | boolean;
		/** 
		 * will not retry if retryIf() 
		 * returns false or throws 
		 * @default - @see BOOL_FN_DEFAULT 
		 */
		retryIf?: (context: RetryContext) => Promise<boolean> | boolean;
		/**
	 	* You can use abort conroller to cancel execution 
	 	* {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController | AbortController}
	 	*/
		signal?: AbortSignal | undefined;
	};

/** Results */
export type RetryOkResult<VALUE_TYPE> = {
	readonly ok: true;
	readonly value: Awaited<VALUE_TYPE>;
	readonly ctx: Readonly<RetryContext>;
};

export type RetryFailedResult = {
	readonly ok: false;
	readonly ctx: Readonly<RetryContext>;
};
