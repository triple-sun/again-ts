import { RetryOnFailException, RetryOnTryException } from "./errors";

export type RetryOptions<T> = {
  tries?: number;
  wait?: number;
  logger?: {
    warn: (...args: unknown[]) => void;
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  onFail?: (
    errors: unknown[],
    attempts: number,
    ...args: unknown[]
  ) => Promise<unknown> | unknown;
  onCatch?: (
    err: unknown,
    attempt: number,
    ...args: unknown[]
  ) => Promise<unknown> | unknown;
  onSuccess?: (
    result: T,
    att: number,
    ...args: unknown[]
  ) => Promise<unknown> | unknown;
  transformOnTryError?: (err: unknown) => RetryOnTryException;
  transformOnFailErrors?: (errors: unknown[]) => RetryOnFailException;
};

export type RetryOkResult<T> = {
  ok: true;
  result: Awaited<T>;
};

export type RetryFailedResult = {
  ok: false;
  errors: unknown[];
};
