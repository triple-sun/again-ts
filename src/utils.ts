import { deepStrictEqual } from "node:assert";
import { ErrorTypeError, StopRetryError } from "./errors";
import type { RetryContext, SealedRetryOptions } from "./types";

export const validateNumericOption = (
	name: string,
	value: number,
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

export const handleError = (
	e: unknown,
	c: RetryContext,
	o: SealedRetryOptions,
): Error => {
	const error = e instanceof Error ? e : new ErrorTypeError(e);

	if (o.skipSameErrorCheck) {
		/** push error to context.errors */
		c.errors.push(error);
	} else {
		try {
			/** check if our last error was the same as this one */
			deepStrictEqual(c.errors[c.errors.length - 1], e);
		} catch (_err) {
			/** if not - push */
			c.errors.push(error);
		}
	}

	if (error instanceof StopRetryError) throw error.original;

	return error;
};

export const getTriesLeft = (
	c: RetryContext,
	o: SealedRetryOptions,
): number => {
	if (Number.isFinite(o.tries)) {
		return Math.max(0, o.tries - c.triesConsumed);
	}
	return o.tries;
};

export const getTimeRemaining = (start: number, timeMax: number) => {
	if (!Number.isFinite(timeMax)) {
		return timeMax;
	}
	return timeMax - (performance.now() - start);
};

export const getWaitTime = (
	timeRemaining: number,
	triesConsumed: number,
	{ random, linear, factor, waitMin, waitMax }: SealedRetryOptions,
) => {
	const randomX = random ? Math.random() + 1 : 1;
	const linearX = linear ? triesConsumed : 1;
	const factorX = factor ** (Math.max(1, triesConsumed + 1) - 1);

	const waitFor = Math.min(waitMax, waitMin * randomX * linearX * factorX);

	return Math.min(waitFor, timeRemaining);
};

export const handleWaitTime = async (
	waitTime: number,
	signal: AbortSignal | null,
) => {
	if (waitTime > 0) {
		await new Promise<void>((resolve, reject) => {
			const onAbort = () => {
				clearTimeout(timeoutToken);
				signal?.removeEventListener("abort", onAbort);
				reject(signal?.reason);
			};

			const timeoutToken = setTimeout(() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			}, waitTime);

			signal?.addEventListener("abort", onAbort, { once: true });

			return timeoutToken;
		});
	}
};
