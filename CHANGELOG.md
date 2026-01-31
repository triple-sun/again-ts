# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-01-31

### Fixed

- **Restored default value of `skipSameErrorCheck` to `false`**
  - By default, retry will now check for consecutive duplicate errors
  - This provides better error handling by default and prevents infinite retries on the same error

- **Improved error type checking performance**
  - Optimized `stopIfErrorTypeError` to check current error first before searching error array
  - Reduces unnecessary array iterations when error type is incorrect

- **Optimized StopError detection**
  - Current error is now checked for `StopError` instance before searching error history
  - Improves performance by avoiding array search in most cases

- **Fixed potential race condition in timeout cleanup**
  - Added undefined checks before calling `clearTimeout` and `timeout.unref()`

### Changed

- **Enhanced type safety for readonly parameters**
  - `onTimeout` callback now receives `Readonly<RetryContext>`
  - Internal utility functions now use `Readonly` for parameters that shouldn't be mutated

## [1.0.3] - 2026-01-31

### Fixed

- **Fixed `onTimeout` callback not being called**
  - The timeout callback is now actually invoked when wait time expires

- **Fixed `retries: 0` validation error**
  - Minimum retries value changed from 1 to 0
  - Now allows immediate failure without retry attempts when `retries: 0` is configured

### Documentation

- **Improved `RetryOptions` JSDoc comments**
  - Added clarification that `timeMax` should be greater than `waitMin`
  - Updated `waitMin` documentation to clarify it's overridden by `timeMax`
  - Added note that `waitMin` should be less than `waitMax`

### Dependencies

- Downgraded `@biomejs/biome` to version 2.3.10 due to issues with VSCode language server in 2.3.13

## [1.0.2] - 2026-01-30

### Changed

- **Refactored retry implementation**
  - Consolidated `retrySafe` and `retryUnsafe` functions into main `retry` function
  - Moved safe/unsafe logic from separate functions into the main type switch
  - Exported `retryLoop` for better code organization
  - Reduced code duplication and improved maintainability

### Fixed

- **Removed excessive `signal.throwIfAborted()` calls**
  - Eliminated redundant abort checks in `onRetryCatch` function

## [1.0.0] - 2026-01-30

### Breaking Changes

- **Renamed `retriesConsumed` to `retriesTaken`** in `RetryContext`
  - This clarifies the distinction between total attempts and consumed retries
  - Migration: Replace all references to `ctx.retriesConsumed` with `ctx.retriesTaken`

- **Removed `timeMin` option from public API**
  - This option was never implemented but was exposed in the TypeScript interface

### Added

- Added exhaustiveness checking in all switch statements for better type safety
- Added validation to prevent `waitMin > waitMax` configuration error
- Added TSDoc comments to `RetryContext.retriesTaken` field

### Fixed

- **Fixed AbortSignal race condition** in timeout handling
  - Event listener is now attached before creating the timeout
  - Prevents edge case where abort signal could be missed

- **Improved browser compatibility** by replacing Node.js `deepStrictEqual` with lightweight error comparison
  - Error deduplication now uses simple `message` and `name` comparison
  - Reduces bundle size and removes Node.js-specific dependency

### Performance

- **Optimized default concurrency path** (when `concurrency === 1`)
  - Eliminates unnecessary array allocation and `Promise.any` overhead

### Documentation

- Added comprehensive CHANGELOG

## [0.x.x] - Previous Versions

Initial development versions before 1.0.0 release.
