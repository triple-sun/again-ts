/** biome-ignore-all lint/performance/noAwaitInLoops: <should chain promises> */
import { RetryFailedError } from "./errors";
import type {
	InternalRetryOptions,
	OnTryFunction,
	RetryContext,
	RetryResult
} from "./types";
import { onRetryCatch } from "./utils";

const retryLoop = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	ctx: RetryContext,
	opts: InternalRetryOptions
): Promise<VALUE_TYPE> => {
	/** spin! */
	while (!Number.isFinite(opts.retries) || ctx.retriesTaken <= opts.retries) {
		ctx.attempts++;
		try {
			opts.signal?.throwIfAborted();
			const value =
				opts.concurrency === 1
					? await onTry(ctx)
					: await Promise.any(
							Array.from({ length: opts.concurrency }).map(() => onTry(ctx))
						);
			opts.signal?.throwIfAborted();
			return value;
		} catch (onTryErr) {
			try {
				await onRetryCatch(onTryErr, ctx, opts);
			} catch (_) {
				break; /** errors already saved in ctx */
			}
		}
	}
	throw new RetryFailedError(ctx);
};

/** original implementation */
export const retrySafe = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	ctx: RetryContext,
	opts: InternalRetryOptions
): Promise<RetryResult<VALUE_TYPE>> => {
	try {
		const value = await retryLoop(onTry, ctx, opts);
		return { value, ok: true, ctx: { ...ctx, end: performance.now() } };
	} catch (_) {
		return { ok: false, ctx: { ...ctx, end: performance.now() } };
	}
};

/** 'unsafe' option */
export const retryUnsafe = async <VALUE_TYPE>(
	onTry: OnTryFunction<VALUE_TYPE>,
	ctx: RetryContext,
	opts: InternalRetryOptions
): Promise<VALUE_TYPE> => retryLoop(onTry, ctx, opts);
