import { retry } from "./retry";
import type {
	RetryFailedResult,
	RetryOkResult,
	RetryOptions,
} from "./types";

export const retryify = <ARGS extends unknown[], VALUE_TYPE>(
	function_: (...arguments_: ARGS) => Promise<VALUE_TYPE> | VALUE_TYPE,
	options: Readonly<RetryOptions>,
): ((
	...arguments_: ARGS
) => Promise<RetryFailedResult | RetryOkResult<VALUE_TYPE>>) => {
	return function (this: unknown, ...arguments_) {
		return retry(() => function_.apply(this, arguments_), options);
	};
};
