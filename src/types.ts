export type RetryOptions = {
  tries?: number /** 0 === try until no error */;
  delay?: number /** delay between attempts */;
  exponential?: boolean /** wait fort delay*attempt */;
  onCatch?: (
    err: unknown,
    attempt: number,
    ...args: unknown[]
  ) => Promise<unknown> | unknown;
};

export type RetryOkResult<T> = {
  ok: true;
  result: Awaited<T>;
  attempts: number;
};

export type RetryFailedResult = {
  ok: false;
  errors: unknown[];
  attempts: number;
};
