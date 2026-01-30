export { ErrorTypeError as NotAnErrorError, StopError } from "./errors";

import { retrySafe } from "./retry-safe";
import { retryUnsafe } from "./retry-unsafe";
import { retryifySafe, retryifyUnsafe } from "./retryify";
import type { OnTryFunction, RetryOptions, RetryResult } from "./types";

export {
	RetryContext,
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
	RetryResult
} from "./types";

export async function retry<VALUE_TYPE>(
	t: "safe",
	onTry: OnTryFunction<VALUE_TYPE>,
	options?: RetryOptions
): Promise<RetryResult<VALUE_TYPE>>;
export async function retry<VALUE_TYPE>(
	t: "unsafe",
	onTry: OnTryFunction<VALUE_TYPE>,
	options?: RetryOptions
): Promise<VALUE_TYPE>;
export function retry<VALUE_TYPE>(
	t: "safe" | "unsafe",
	onTry: OnTryFunction<VALUE_TYPE>,
	options: RetryOptions = {}
): Promise<RetryResult<VALUE_TYPE> | VALUE_TYPE> {
	switch (t) {
		case "safe":
			return retrySafe(onTry, options);
		case "unsafe":
			return retryUnsafe(onTry, options);
	}
}

export function retryify<ARGS extends unknown[], VALUE_TYPE>(
	t: "safe",
	function_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>
): (...arguments_: ARGS) => Promise<RetryResult<VALUE_TYPE>>;
export function retryify<ARGS extends unknown[], VALUE_TYPE>(
	t: "unsafe",
	function_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>
): (...arguments_: ARGS) => Promise<VALUE_TYPE>;
export function retryify<ARGS extends unknown[], VALUE_TYPE>(
	t: "safe" | "unsafe",
	function_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>
): (...arguments_: ARGS) => Promise<RetryResult<VALUE_TYPE> | VALUE_TYPE> {
	switch (t) {
		case "safe":
			return retryifySafe(function_, options);
		case "unsafe":
			return retryifyUnsafe(function_, options);
	}
}
