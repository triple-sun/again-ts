import { deepStrictEqual } from "node:assert";
import {
	BOOL_FN_DEFAULT,
	FACTOR_DEFAULT,
	TIME_MAX_DEFAULT,
	TRIES_DEFAULT,
	WAIT_MAX_DEFAULT,
	WAIT_MIN_DEFAULT,
} from "./defaults";

import { ErrorTypeError, StopRetryError } from "./errors";
import type { RetryContext, RetryOptions } from "./types";

export const wait = (duration: number) => {
	return new Promise((resolve) => setTimeout(resolve, duration));
};

export const validateNumericOption = (
	name: Readonly<string>,
	value: Readonly<number>,
	{ finite = true, min = 0 }: { finite?: boolean; min?: number } = {},
): void => {
	if (value === undefined) return;
	if (typeof value !== "number" || Number.isNaN(value)) {
		throw new TypeError(`'${name}' should be a number`);
	}
	if (value < min) {
		throw new RangeError(`'${name}' should be >= ${min}`);
	}
	if (finite && !Number.isFinite(value)) {
		throw new RangeError(`'${name}' should be finite`);
	}
};

export const getError = (e: unknown): Error => {
	if (!(e instanceof Error)) {
		return new ErrorTypeError(e);
	}

	if (e instanceof AggregateError) {
		for (const innerError of e.errors) {
			if (!(innerError instanceof Error)) {
				return new ErrorTypeError(innerError);
			}
		}
	}

	return e;
};

export const saveErrorToCtx = (
	e: Readonly<Error>,
	c: RetryContext,
	o: Readonly<RetryOptions>,
): void => {
	const incomingErrors =
		e instanceof StopRetryError
			? [e.original]
			: e instanceof AggregateError
				? e.errors.map(getError)
				: [e];

	if (e instanceof AggregateError) {
		e.errors.forEach((curr, i) => {
			try {
				deepStrictEqual(curr, e.errors[i + 1]);
				e.errors = e.errors.splice(i, 1);
			} catch (_err) {}
		});
	}

	if (o.skipSameErrorCheck) {
		c.errors.push(...incomingErrors);
	} else {
		for (const e of incomingErrors) {
			try {
				deepStrictEqual(e, c.errors[c.errors.length - 1]);
			} catch (_err) {
				c.errors.push(e);
			}
		}
	}
};

export const getTriesLeft = (
	c: RetryContext,
	tries: Readonly<number> = TRIES_DEFAULT,
): Readonly<number> => {
	if (Number.isFinite(tries)) return Math.max(0, tries - c.triesConsumed);
	return tries;
};

export const getTimeRemaining = (
	start: number,
	timeMax: Readonly<number> = TIME_MAX_DEFAULT,
): Readonly<number> => {
	if (!Number.isFinite(timeMax)) return timeMax;
	return timeMax - (performance.now() - start);
};

export const getWaitTime = (
	timeRemaining: Readonly<number>,
	triesConsumed: Readonly<number>,
	{
		random,
		linear,
		factor = FACTOR_DEFAULT,
		waitMin = WAIT_MIN_DEFAULT,
		waitMax = WAIT_MAX_DEFAULT,
	}: Readonly<RetryOptions>,
): Readonly<number> => {
	const randomX = random ? Math.random() + 1 : 1;
	const linearX = linear ? triesConsumed : 1;
	const factorX = factor ** (Math.max(1, triesConsumed + 1) - 1);

	const waitFor = Math.min(waitMax, waitMin * randomX * linearX * factorX);

	return Math.min(waitFor, timeRemaining);
};

export const tryBoolFn = async (
	boolFn: (c: RetryContext) => Promise<boolean> | boolean = BOOL_FN_DEFAULT,
	c: RetryContext,
	o: RetryOptions,
): Promise<boolean> => {
	try {
		return await boolFn(c);
	} catch (e) {
		saveErrorToCtx(getError(e), c, o);
		return false;
	}
};
