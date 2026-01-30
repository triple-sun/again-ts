# again-ts

[![NPM Version](https://img.shields.io/npm/v/again-ts.svg?style=flat-square)](https://www.npmjs.com/package/again-ts)
[![NPM Downloads](https://img.shields.io/npm/dt/again-ts.svg?style=flat-square)](https://www.npmjs.com/package/again-ts)

Async function retrying written in typescript.

## Installation

```bash
npm install again-ts
```

## Usage

### `retry('safe')`

The `retry('safe')` function allows you to execute an async function with retry logic. It never throws and returns a result object indicating success or failure.

```typescript
import { retry } from 'again-ts';

// Basic usage
const result = await retry('safe', async (ctx) => {
    // ctx contains information about the current attempt
    console.log(`Attempt #${ctx.attempts}`);
    return await someAsyncOperation();
}, {
    retries: 3,
    waitMin: 1000
});

if (result.ok) {
    console.log('Success:', result.value); // result.value is the return value of your function
} else {
    console.error(`Failed after ${result.ctx.attempts} attempts:`, result.ctx.errors);
}
```

### `retry('unsafe')`

The `retry('unsafe')` function allows you to execute an async function with retry logic. It doesn't wrap returned value and throws `RetryFailedError` on failure.

```typescript
import { retry } from 'again-ts';

// 'unsafe'
try {
    const result = await retry('unsafe', async (ctx) => {
    // ctx contains information about the current attempt
    console.log(`Attempt #${ctx.attempts}`);
    return await someAsyncOperation();
}, {
    retries: 5,
    waitMin: 500
});} catch (err){
    // throws RetryFailedError with errors in .ctx
    console.error(err.message)
    console.error(err.ctx.errors)
}
```

### `retryify`

`retryify` wraps an existing function with retry logic, returning a new function that behaves like the original but with built-in retries.

```typescript
import { retryify } from 'again-ts';

const unstableFetch = async (url: string) => { /* ... */ };

const fetchWithRetry = retryify('safe', unstableFetch, {
    retries: 5,
    factor: 2, // exponential backoff
});

const result = await fetchWithRetry('https://api.example.com');

if (result.ok) {
    // ...
}
```

## API Reference

### RetryOptions

| Option               | Type                                   | Default      | Description                                                                                   |
| -------------------- | -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `retries`            | `number`                               | `4`          | Number of retries (not including the first attempt). Set to `Infinity` to retry indefinitely. |
| `timeMax`            | `number`                               | `Infinity`   | Maximum execution time in milliseconds for the entire retry process.                          |
| `waitMin`            | `number`                               | `100`        | Minimum wait time between attempts in milliseconds.                                           |
| `waitMax`            | `number`                               | `Infinity`   | Maximum wait time between attempts in milliseconds.                                           |
| `factor`             | `number`                               | `1`          | Exponential backoff factor. Formula: `waitMin * factor^(retriesTaken)`.                       |
| `linear`             | `boolean`                              | `true`       | If true, wait time scales linearly with the retry number.                                     |
| `random`             | `boolean`                              | `false`      | If true, adds randomization to the wait time.                                                 |
| `skipSameErrorCheck` | `boolean`                              | `true`       | If true, identical consecutive errors are stored separately in the errors array.              |
| `waitIfNotConsumed`  | `boolean`                              | `false`      | If true, waits even when a retry is not consumed (when `consumeIf` returns false).            |
| `onCatch`            | `(ctx) => void \| Promise<void>`       | `() => null` | Function called when an error is caught, before deciding to retry.                            |
| `retryIf`            | `(ctx) => boolean \| Promise<boolean>` | `() => true` | Predicate function to determine if a retry should be attempted.                               |
| `consumeIf`          | `(ctx) => boolean \| Promise<boolean>` | `() => true` | Predicate function. If it returns `false`, the retry is not counted towards `retriesTaken`.   |
| `signal`             | `AbortSignal \| null`                  | `null`       | AbortSignal to cancel the retry process.                                                      |
| `concurrency`        | `number`                               | `1`          | Number of concurrent async executions per attempt.                                            |

### RetryContext

The context object returned in result and passed to `onTry`, `onCatch`, `retryIf`, `consumeIf`.

- `attempts`: Total number of attempts made so far (starts at 1).
- `retriesTaken`: Number of retries consumed (usually `attempts - 1`, unless `consumeIf` returned false).
- `errors`: Array of errors encountered so far.
- `start`: Timestamp when the retry process started.
- `end`: Timestamp when the retry process ended.

## License

ISC
