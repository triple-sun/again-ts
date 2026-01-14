/** Using object type for simplicity of extension in the future */
export interface RetryContext {
		errors: Error[];
		attempts: number;
		triesLeft: number;
		triesConsumed: number;
		readonly start: number;
		end: number;
	}

export interface RetryOptions {
	readonly tries?: number /** Infinity === try until no error @default 5 */;
	readonly timeLimit?: number /** limit execution by ms @default Number.POSITIVE_INFINITY */;
	readonly waitMin?: number /** wait between attempts @default 100 */;
	readonly waitMax?: number /** wait between attempts @default Number.POSITIVE_INFINITY */;
	readonly factor?: number /** multiply delay by exponent**consumed @default 1 */;
	readonly linear?: boolean /** multply delay by attempt @default false */;
	readonly random?: boolean /** randomize time between tries @default false */;
	readonly skipSameErrorCheck?: boolean /** add same errors to returned array @default false */;
	/** function to call on catch */
	readonly onCatch?: (context: RetryContext) => Promise<unknown> | unknown;
	/** increment attempts by 1 only if returns true */
	readonly consumeIf?: (context: RetryContext) => Promise<boolean> | boolean;
	readonly retryIf?: (context: RetryContext) => Promise<boolean> | boolean;
	/**  */
	/**
	 	* You can use abort conroller to cancel everything 
	 	* {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController | AbortController}
	 	* @example 
	 	```
		import { retry } from 'retry-ts';
		import { EventEmitter } from "node:stream";

		const controller = new AbortController();
		const fn = async () => {};
		const cancelFn = () => {
			controller.abort(new Error('Called cancel function'));
		}

		try {
			await pRetry(run, {signal: controller.signal});
		} catch (error) {
			console.log(error.message); // 'Called cancel function'
		}
		```
	 	*/
	readonly signal?: AbortSignal | null | undefined;
}

export interface RetryOkResult<T> {
	readonly ok: true;
	readonly value: Awaited<T>;
	readonly context: Readonly<RetryContext>;
}

export interface RetryFailedResult {
	readonly ok: false;
	readonly context: Readonly<RetryContext>;
}

export interface SealedOptions extends Readonly<Required<RetryOptions>> {}
