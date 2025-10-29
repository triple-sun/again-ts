import { RetryOnFailException } from "./errors";
import { RetryFailedResult, RetryOkResult, RetryOptions } from "./types";
import { wait } from "./wait";

/**
 * @param onTry - main callback
 * @param options.tries - tries; 0 === try until no error
 * @param options.delay - delay between attempts
 * @param options.exponential - use wait(delay*attempt) instead of wait(delay)
 * @param options.onCatch - callback to call on every catch
 * @returns @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <T>(
  onTry: (attempt: number, ...args: unknown[]) => Promise<T> | T,
  { onCatch, tries = 5, delay = 100, exponential = false }: RetryOptions = {
    tries: 5,
    delay: 100,
    exponential: false,
  }
): Promise<RetryOkResult<T> | RetryFailedResult> => {
  let attempts = 0;
  const errors: unknown[] = [];

  while (tries === 0 || attempts < tries) {
    attempts += 1;
    try {
      const result = await onTry(attempts);
      return { ok: true, value: result, attempts };
    } catch (error) {
      errors.push(error);
      if (onCatch) await onCatch(error, attempts);
      if (delay) await wait(exponential ? delay * attempts : delay);
    }
  }

  return { ok: false, errors, attempts };
};
