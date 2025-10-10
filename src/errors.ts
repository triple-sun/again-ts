export class RetryOnTryException extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class RetryOnFailException extends Error {
  constructor(message: string) {
    super(message);
  }
}
