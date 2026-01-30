import { deepStrictEqual } from "node:assert";
import {
	BOOL_FN_DEFAULT,
	CONCURRENCY_DEFAULT,
	FACTOR_DEFAULT,
	LINEAR_DEFAULT,
	ON_CATCH_DEFAULT,
	RANDOM_DEFAULT,
	RETRIES_DEFAULT,
	SKIP_SAME_ERROR_CHECK_DEFAULT,
	TIME_MAX_DEFAULT,
	TIME_MIN_DEFAULT,
	WAIT_IF_NOT_CONSUMED_DEFAULT,
	WAIT_MAX_DEFAULT,
	WAIT_MIN_DEFAULT
} from "./defaults";
import { ErrorTypeError, StopError } from "./errors";
import type { InternalRetryOptions, RetryContext, RetryOptions } from "./types";

export const wait = (ms: number) => {
	return new Promise(resolve => setTimeout(resolve, ms));
};

export const createRetryContext = (): RetryContext => ({
	errors: [],
	attempts: 0,
	retriesConsumed: 0,
	start: performance.now(),
	end: performance.now()
});

export const getInternalOptions = (
	options: RetryOptions
): InternalRetryOptions =>
	Object.freeze({
		retries: RETRIES_DEFAULT,
		timeMin: TIME_MIN_DEFAULT,
		timeMax: TIME_MAX_DEFAULT,
		waitMin: WAIT_MIN_DEFAULT,
		waitMax: WAIT_MAX_DEFAULT,
		factor: FACTOR_DEFAULT,
		linear: LINEAR_DEFAULT,
		random: RANDOM_DEFAULT,
		skipSameErrorCheck: SKIP_SAME_ERROR_CHECK_DEFAULT,
		waitIfNotConsumed: WAIT_IF_NOT_CONSUMED_DEFAULT,
		onCatch: ON_CATCH_DEFAULT,
		consumeIf: BOOL_FN_DEFAULT,
		retryIf: BOOL_FN_DEFAULT,
		concurrency: CONCURRENCY_DEFAULT,
		signal: null,
		...options
	});

export const validateNumericOption = (
	key: keyof RetryOptions,
	value: Readonly<number>,
	{ finite = true, min = 0 }: { finite?: boolean; min?: number } = {}
): void => {
	if (value === undefined) return;
	if (typeof value !== "number" || Number.isNaN(value)) {
		throw new ErrorTypeError(`'${key}' should be a number`);
	}
	if (value < min) {
		throw new RangeError(`'${key}' should be >= ${min}`);
	}
	if (finite && !Number.isFinite(value)) {
		throw new RangeError(`'${key}' should be finite`);
	}
};

export const validateOptions = (opts: InternalRetryOptions) => {
	validateNumericOption("retries", opts.retries, {
		finite: false,
		min: 1
	});
	validateNumericOption("waitMin", opts.waitMin, {
		finite: true
	});
	validateNumericOption("waitMax", opts.waitMax, {
		finite: false
	});
	validateNumericOption("timeMax", opts.timeMax, {
		finite: false
	});
	validateNumericOption("factor", opts.factor, {
		finite: true
	});
	validateNumericOption("concurrency", opts.concurrency, {
		finite: true,
		min: 1
	});
};

export const getError = (err: unknown): Error =>
	err instanceof Error ? err : new ErrorTypeError(err);

export const saveErrorsToContext = (
	err: Readonly<Error>,
	ctxErrors: Error[],
	opts: Readonly<RetryOptions>
): void => {
	const incoming: Error[] = [];

	switch (true) {
		case err instanceof StopError:
			incoming.push(err.original);
			break;
		case err instanceof AggregateError:
			incoming.push(...err.errors.map(getError));
			break;
		default:
			incoming.push(err);
	}

	if (opts.skipSameErrorCheck) {
		ctxErrors.push(...incoming);
	} else {
		for (const e of incoming) {
			try {
				deepStrictEqual(e, ctxErrors[ctxErrors.length - 1]);
			} catch (_err) {
				ctxErrors.push(e);
			}
		}
	}
};

export const getTriesLeft = (
	ctx: RetryContext,
	retries: Readonly<number>
): Readonly<number> => {
	if (!Number.isFinite(retries)) return retries;
	return Math.max(0, retries - ctx.retriesConsumed);
};

export const getTimeRemaining = (
	start: Readonly<number>,
	timeMax: Readonly<number>,
	now: Readonly<number>
): Readonly<number> => {
	if (!Number.isFinite(timeMax)) return timeMax;
	return timeMax - (now - start);
};

export const getWaitTime = (
	opts: InternalRetryOptions,
	timeRemaining: Readonly<number>,
	triesConsumed: Readonly<number>
): Readonly<number> => {
	const randomX = opts.random ? Math.random() + 1 : 1;
	const linearX = opts.linear ? triesConsumed : 1;
	const factorX = opts.factor ** (Math.max(1, triesConsumed + 1) - 1);

	const waitFor = Math.min(
		opts.waitMax,
		opts.waitMin * randomX * linearX * factorX
	);

	return Math.min(waitFor, timeRemaining);
};

export const tryBoolFn = async (
	boolFn: (c: Readonly<RetryContext>) => Promise<boolean> | boolean,
	ctx: Readonly<RetryContext>,
	opts: InternalRetryOptions
): Promise<boolean> => {
	try {
		return await boolFn(ctx);
	} catch (e) {
		saveErrorsToContext(getError(e), ctx.errors, opts);
		return false;
	}
};

export const onRetryCatch = async (
	e: unknown,
	ctx: RetryContext,
	opts: InternalRetryOptions
): Promise<void> => {
	const error = getError(e);

	/** save error first so retryIf/consumeIf errors come later */
	saveErrorsToContext(error, ctx.errors, opts);

	/** stop if we receive stop error */
	const stopError = ctx.errors.find(e => e instanceof StopError);
	if (stopError) throw stopError.original;

	opts.signal?.throwIfAborted();
	const triesLeft = getTriesLeft(ctx, opts.retries);

	opts.signal?.throwIfAborted();
	const timeRemaining = getTimeRemaining(
		ctx.start,
		opts.timeMax,
		performance.now()
	);

	opts.signal?.throwIfAborted();
	await opts.onCatch(ctx);

	opts.signal?.throwIfAborted();
	const shouldConsume = await tryBoolFn(opts.consumeIf, ctx, opts);

	/** handle time and tries limits */
	if (timeRemaining <= 0 || triesLeft <= 0) throw error;

	/** stop if we wrong type was thrown */
	const typeError = ctx.errors.find(e => e instanceof ErrorTypeError);
	if (typeError) {
		if (shouldConsume) throw typeError;
		opts.signal?.throwIfAborted();
		return;
	}

	/** determine should we retry or not */
	opts.signal?.throwIfAborted();
	if (!(await tryBoolFn(opts.retryIf, ctx, opts))) throw error;

	/** do not counsume or delay if shouldn't */
	opts.signal?.throwIfAborted();
	if (!shouldConsume && !opts.waitIfNotConsumed) return;

	/** get wait time */
	opts.signal?.throwIfAborted();
	const waitTime = getWaitTime(opts, timeRemaining, ctx.retriesConsumed);

	opts.signal?.throwIfAborted();
	if (waitTime > 0) {
		let timeout: NodeJS.Timeout;
		await new Promise<void>((resolve, reject) => {
			const onAbort = () => {
				clearTimeout(timeout);
				opts.signal?.removeEventListener("abort", onAbort);
				reject(opts.signal?.reason);
			};

			timeout = setTimeout(() => {
				opts.signal?.removeEventListener("abort", onAbort);
				resolve();
			}, waitTime);

			opts.signal?.addEventListener("abort", onAbort, { once: true });

			return timeout;
		}).finally(() => {
			timeout?.unref();
		});
	}

	if (shouldConsume) ctx.retriesConsumed++;
};
