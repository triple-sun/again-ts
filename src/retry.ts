import { RetryOnFailException } from "./errors";
import { RetryFailedResult, RetryOkResult, RetryOptions } from "./types";
import { wait } from "./wait";

/**
 *
 * @param onTry - main callback
 * @param options.tries - tries; 0 === try until no error
 * @param options.delay - delay between attempts
 * @param options.exponential - use wait(delay*attempt) instead of wait(delay)
 * @param options.onCatch - callback to call on every catch
 * @returns @see RetryOkResult @see RetryFailedResult
 */
export const retry = async <T>(
  onTry: (attempt: number, ...args: unknown[]) => Promise<T> | T,
  options: RetryOptions = {
    tries: 5,
    delay: 100,
    exponential: false,
  }
): Promise<RetryOkResult<T> | RetryFailedResult> => {
  let attempts = 0;

  const { onCatch, tries = 5, delay = 100, exponential = false } = options;

  const errors: unknown[] = [];

  while (tries === 0 || attempts < tries) {
    attempts += 1;
    try {
      /** Try */
      const result = await onTry(attempts);
      /** Exit cycle if no err */
      return { ok: true, result, attempts };
    } catch (error) {
      /** Save error for later */
      errors.push(error);
      /** Call on catch function */
      if (onCatch) await onCatch(error, attempts);
      /** Wait for set time */
      if (delay) await wait(exponential ? delay * attempts : delay);
      /** Continue to next interation */
      continue;
    }
  }

  return { ok: false, errors, attempts };
};
