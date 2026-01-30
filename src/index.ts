export { ErrorTypeError, StopError } from "./errors";

import { retrySafe, retryUnsafe } from "./retry";
import type { OnTryFunction, RetryOptions, RetryResult } from "./types";
import {
	createInternalOptions,
	createRetryContext,
	validateOptions
} from "./utils";

export type {
	OnTryFunction,
	RetryContext,
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
	RetryResult
} from "./types";

export async function retry<VALUE_TYPE>(
	type: "safe",
	onTry: OnTryFunction<VALUE_TYPE>,
	options?: RetryOptions
): Promise<RetryResult<VALUE_TYPE>>;
export async function retry<VALUE_TYPE>(
	type: "unsafe",
	onTry: OnTryFunction<VALUE_TYPE>,
	options?: RetryOptions
): Promise<VALUE_TYPE>;
export async function retry<VALUE_TYPE>(
	type: "safe" | "unsafe",
	onTry: OnTryFunction<VALUE_TYPE>,
	options: RetryOptions = {}
): Promise<RetryResult<VALUE_TYPE> | VALUE_TYPE> {
	const opts = createInternalOptions(options);
	/** validate */
	validateOptions(opts);
	/** mutable context object */
	const ctx = createRetryContext();
	switch (type) {
		case "safe":
			return await retrySafe(onTry, ctx, opts);
		case "unsafe":
			return await retryUnsafe(onTry, ctx, opts);
		default: {
			const _exhaustive: never = type;
			throw new Error(`Unexpected type: ${_exhaustive}`);
		}
	}
}

export function retryify<ARGS extends unknown[], VALUE_TYPE>(
	type: "safe",
	fn_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>
): (...arguments_: ARGS) => Promise<RetryResult<VALUE_TYPE>>;
export function retryify<ARGS extends unknown[], VALUE_TYPE>(
	type: "unsafe",
	fn_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>
): (...arguments_: ARGS) => Promise<VALUE_TYPE>;
export function retryify<ARGS extends unknown[], VALUE_TYPE>(
	type: "safe" | "unsafe",
	fn_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>
): (...arguments_: ARGS) => Promise<RetryResult<VALUE_TYPE> | VALUE_TYPE> {
	switch (type) {
		case "safe":
			return function (this: unknown, ...arguments_) {
				return retry("safe", () => fn_.apply(this, arguments_), options);
			};
		case "unsafe":
			return function (this: unknown, ...arguments_) {
				return retry("unsafe", () => fn_.apply(this, arguments_), options);
			};
	}
}
