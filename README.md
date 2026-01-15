# again-ts

Async function retrying written in typescript.

## Installation

```bash
npm install again-ts
```

## Usage

### `retry`

The `retry` function allows you to execute an async function with retry logic. It returns a result object indicating success or failure.

```typescript
import { retry } from 'again-ts';

// Basic usage
const result = await retry(async (ctx) => {
    // ctx contains information about the current attempt
    console.log(`Attempt #${ctx.attempts}`);
    return await someAsyncOperation();
}, {
    tries: 3,
    waitMin: 1000
});

if (result.ok) {
    console.log('Success:', result.value); // result.value is the return value of your function
} else {
    console.error(`Failed after ${result.ctx.attempts} retries:`, result.ctx.errors);
}
```

### `retryify`

`retryify` wraps an existing function with retry logic, returning a new function that behaves like the original but with built-in retries.

```typescript
import { retryify } from 'again-ts';

const unstableFetch = async (url: string) => { /* ... */ };

const fetchWithRetry = retryify(unstableFetch, {
    tries: 5,
    factor: 2, // exponential backoff
});

const result = await fetchWithRetry('https://api.example.com');

if (result.ok) {
    // ...
}
```

## API Reference

### RetryOptions

| Option | Type | Default | Description |
|Str|Str|Str|Str|
| `tries` | `number` | `5` | Maximum number of attempts (including the first one). Set to `Infinity` to retry indefinitely. |
| `timeMax` | `number` | `Infinity` | Maximum execution time in milliseconds for the entire retry process. |
| `waitMin` | `number` | `100` | Minimum wait time between attempts in milliseconds. |
| `waitMax` | `number` | `Infinity` | Maximum wait time between attempts in milliseconds. |
| `factor` | `number` | `1` | Exponential backoff factor. Logic: `factor ** (triesConsumed - 1)` (after first retry). |
| `linear` | `boolean` | `true` | If true, wait time scales linearly with the attempt number. Note: First retry (attempt 2) has `triesConsumed=0`, so wait time is 0 if linear is true. |
| `random` | `boolean` | `false` | If true, adds randomization to the wait time. |
| `skipSameErrorCheck` | `boolean` | `false` | If true, generic errors are collected even if they are identical to the previous one. |
| `onCatch` | `(ctx) => void` | `noop` | Function called when an error is caught, before deciding to retry. |
| `retryIf` | `(ctx) => boolean` | `() => true` | Predicate function to determine if a retry should be attempted based on the error/context. |
| `consumeIf` | `(ctx) => boolean` | `() => true` | Predicate function. If it returns `false`, the attempt is not counted towards `triesConsumed`. |
| `signal` | `AbortSignal` | `undefined` | AbortSignal to cancel the retry process. |

### RetryContext

The context object returned in result and passed to `onTry`, `onCatch`, `retryIf`, `consumeIf`.

- `attempts`: Total number of attempts made so far (starts at 1).
- `triesConsumed`: Number of tries "consumed" (usually `attempts - 1`, unless `consumeIf` returned false).
- `errors`: Array of errors encountered so far.
- `start`: Timestamp when the retry process started.
- `end`: Timestamp when the retry process ended (only in result).

## License

ISC
