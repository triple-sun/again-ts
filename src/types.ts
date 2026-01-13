/** Using object type for simplicity of extension in the future */
export type RetryContext = {
	errors: Error[];
	attempt: number;
	triesLeft: number;
	triesConsumed: number;
	end?: DOMHighResTimeStamp;
	readonly start: DOMHighResTimeStamp;
};

export type RetryOptions = {
		tries?: number /** Infinity === try until no error @default 5 */;
		limit?: number /** limit execution by ms @default Number.POSITIVE_INFINITY */;
		delay?: number /** delay between attempts @default 100 */;
		grow?: number /** multply delay by *attempt @default false */;
		exponent?: number /** multiply delay by *exponent @default 1 */;
		skipSameErrorCheck?: boolean /** add same errors to returned array @default false */;
		/** function to call on catch */
		onCatch?: (context: RetryContext) => Promise<unknown> | unknown;
		/** increment attempts by 1 if true */
		consumeIf?: (context: RetryContext) => Promise<boolean> | boolean;
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
		signal?: AbortSignal | undefined;
	};

export type RetryOkResult<T> = {
	readonly ok: true;
	readonly value: Awaited<T>;
	readonly context: Readonly<RetryContext>;
};

export type RetryFailedResult = {
	readonly ok: false;
	readonly context: Readonly<RetryContext>;
};
