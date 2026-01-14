import { deepStrictEqual } from "node:assert";
import { AbortError } from "./errors";
import type { RetryContext, RetryOptions, SealedOptions } from "./types";

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

export const sealOptions = (options: RetryOptions): SealedOptions => {
	return {
		tries: options.tries ?? 5,
		timeLimit: options.timeLimit ?? Number.POSITIVE_INFINITY,
		waitMin: options.waitMin ?? 1000,
		waitMax: options.waitMax ?? Number.POSITIVE_INFINITY,
		factor: options.factor ?? 1,
		linear: options.linear ?? false,
		random: false,
		skipSameErrorCheck: options.skipSameErrorCheck || false,
		onCatch: options.onCatch ?? (() => {}),
		consumeIf: options.consumeIf ?? (() => true),
		retryIf: options.retryIf ?? (() => true),
		signal: options.signal || null,
	};
};

export const handleError = (
	e: unknown,
	{ errors }: RetryContext,
	{ skipSameErrorCheck }: SealedOptions,
): Error => {
	const error =
		e instanceof Error
			? e
			: new TypeError(`Expected instanceof Error, got: "${e}"`);

	if (skipSameErrorCheck) {
		/** push error to context.errors */
		errors.push(error);
	} else {
		try {
			/** check if our last error was the same as this one */
			deepStrictEqual(errors[errors.length - 1], e);
		} catch (_err) {
			/** if not - push */
			errors.push(error);
		}
	}

	if (error instanceof AbortError) return error.original;

	return error;
};

export const handleTries = (
	e: Error,
	{ triesConsumed, triesLeft }: RetryContext,
	{ tries }: SealedOptions,
): void => {
	if (!Number.isFinite(triesLeft)) return;
	triesLeft = Math.max(0, tries - triesConsumed);
	if (triesLeft <= 0) throw e;
};

export const handleTimeLimit = (
	e: Error,
	start: number,
	timeLimit: number,
): number => {
	const elapsed = performance.now() - start;
	if (elapsed > timeLimit) throw e;
	/** return time remaining */
	if (Number.isFinite(timeLimit)) return timeLimit - elapsed
	return timeLimit
};

export const getWaitTime = (
	timeRemaining: number,
	triesConsumed: number,
	{ random, linear, factor, waitMin, waitMax }: SealedOptions,
) => {
	const randomX = random ? Math.random() + 1 : 1;
	const linearX = linear ? triesConsumed : 1;
	const factorX = factor ** (Math.max(1, triesConsumed + 1) - 1);

	const waitFor = Math.min(waitMax, waitMin * randomX * linearX * factorX);
	
	return Math.min(waitFor, timeRemaining);
};

export const handleWait = async (
	waitTime: number,
	signal: AbortSignal| null,
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
