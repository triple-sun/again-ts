import { RetryFailedResult, RetryOkResult, RetryOptions } from "./types";

export const retry = async <T>(
  onTry: (attempt: number, ...args: unknown[]) => Promise<T> | T,
  { onCatch, onFail, tries = 5, wait = 100, logger }: RetryOptions<T> = {
    tries: 5,
    wait: 100,
  }
): Promise<RetryOkResult<T> | RetryFailedResult> => {
  let attempt = 0;
  const errors: unknown[] = [];

  while (attempt < tries) {
    attempt += 1;

    try {
      const result = await onTry(attempt);

      return { ok: true, result };
    } catch (onTryError) {
      errors.push(onTryError);

      if (onCatch) {
        onCatch(onTryError, attempt);
      } else if (logger) {
        logger.error(onTryError);
      }

      if (wait) await new Promise((res) => setTimeout(res, wait));

      continue;
    }
  }

  if (onFail) {
    await onFail(errors, attempt);
  } else if (logger) {
    logger.error(
      `retry failed with [${attempt}] attempts: [${JSON.stringify(errors)}]`
    );
  }

  return { ok: false, errors };
};
