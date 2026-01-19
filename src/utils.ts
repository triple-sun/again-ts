import { deepStrictEqual } from "node:assert";
import { ErrorTypeError, StopRetryError } from "./errors";
import type { RetryContext, RetryOptions } from "./types";

export const wait = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export const validateNumericOption = (
	name: Readonly<string>,
	value: Readonly<number>,
	{ finite = true, min = 0 }: { finite?: boolean; min?: number } = {},
): void => {
	if (value === undefined) return;
	if (typeof value !== "number" || Number.isNaN(value)) {
		throw new ErrorTypeError(`'${name}' should be a number`);
	}
	if (value < min) {
		throw new RangeError(`'${name}' should be >= ${min}`);
	}
	if (finite && !Number.isFinite(value)) {
		throw new RangeError(`'${name}' should be finite`);
	}
};

export const getError = (err: unknown): Error =>
	err instanceof Error ? err : new ErrorTypeError(err);

export const saveErrorsToCtx = (
	err: Readonly<Error>,
	ctxErrors: Error[],
	opts: Readonly<RetryOptions>,
): void => {
	const incoming: Error[] = [];

	switch (true) {
		case err instanceof StopRetryError:
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
	tries: Readonly<number>,
): Readonly<number> => {
	if (Number.isFinite(tries)) return Math.max(0, tries - ctx.triesConsumed);
	return tries;
};

export const getTimeRemaining = (
	start: Readonly<number>,
	timeMax: Readonly<number>,
	now: Readonly<number>,
): Readonly<number> => {
	if (!Number.isFinite(timeMax)) return timeMax;
	return timeMax - (now - start);
};

export const getWaitTime = (
	opts: Readonly<Required<RetryOptions>>,
	timeRemaining: Readonly<number>,
	triesConsumed: Readonly<number>,
): Readonly<number> => {
	const randomX = opts.random ? Math.random() + 1 : 1;
	const linearX = opts.linear ? triesConsumed : 1;
	const factorX = opts.factor ** (Math.max(1, triesConsumed + 1) - 1);

	const waitFor = Math.min(
		opts.waitMax,
		opts.waitMin * randomX * linearX * factorX,
	);

	return Math.min(waitFor, timeRemaining);
};

export const tryBoolFn = async (
	boolFn: (c: Readonly<RetryContext>) => Promise<boolean> | boolean,
	ctx: Readonly<RetryContext>,
	opts: Readonly<Required<RetryOptions>>,
): Promise<boolean> => {
	try {
		return await boolFn(ctx);
	} catch (e) {
		saveErrorsToCtx(getError(e), ctx.errors, opts);
		return false;
	}
};
