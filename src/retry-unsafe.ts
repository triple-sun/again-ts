import { RetryFailedError } from "./errors";
import type { OnTryFunction, RetryOptions } from "./types";
import {
	createRetryContext,
	getInternalOptions,
	onRetryCatch,
	validateOptions
} from "./utils";

export const retryUnsafe = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	options: RetryOptions = {}
): Promise<VALUE_TYPE> => {
	const opts = getInternalOptions(options);

	validateOptions(opts);

	/** create mutable context object */
	const ctx = createRetryContext();

	/** spin! */
	while (
		!Number.isFinite(opts.retries) ||
		ctx.retriesConsumed <= opts.retries
	) {
		ctx.attempts++;

		try {
			opts.signal?.throwIfAborted();
			// biome-ignore lint/performance/noAwaitInLoops: <should run in queue>
			const value = await Promise.any(
				Array.from({ length: opts.concurrency }, async () => await onTry(ctx))
			);

			opts.signal?.throwIfAborted();
			return value;
		} catch (onTryErr) {
			try {
				await onRetryCatch(onTryErr, ctx, opts);
			} catch (_) {
				throw new RetryFailedError(ctx);
			}
		}
	}

	throw new Error("this should literally be impossible");
};
