import type { OnTryFunction, RetryOptions, RetryResult } from "./types";
import {
	createRetryContext,
	getInternalOptions,
	onRetryCatch,
	validateOptions
} from "./utils";

/**
 * @param onTry - main function to be retried
 * @param o - @see RetryOptions
 * @returns - @see RetryOkResult @see RetryFailedResult
 */
export const retrySafe = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	options: RetryOptions = {}
): Promise<RetryResult<VALUE_TYPE>> => {
	const opts = getInternalOptions(options);

	validateOptions(opts);

	/** mutable context object */
	const ctx = createRetryContext();

	/** spin! */
	while (
		!Number.isFinite(opts.retries) ||
		ctx.retriesConsumed <= opts.retries
	) {
		ctx.attempts++;

		try {
			opts.signal?.throwIfAborted();
			// biome-ignore lint/performance/noAwaitInLoops: <should not be concurrent>
			const value = await Promise.any(
				Array.from({ length: opts.concurrency }, async () => await onTry(ctx))
			);

			opts.signal?.throwIfAborted();
			return {
				ok: true,
				value,
				ctx: { ...ctx, end: performance.now() }
			};
		} catch (onTryErr) {
			/** try so we can safely abort by throwing */
			try {
				await onRetryCatch(onTryErr, ctx, opts);
			} catch (_) {
				/** errors are already saved to result.ctx.errors */
				break;
			}
		}
	}

	return { ok: false, ctx: { ...ctx, end: performance.now() } };
};
