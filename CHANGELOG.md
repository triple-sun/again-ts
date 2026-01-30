# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-30

### Breaking Changes

- **Renamed `retriesConsumed` to `retriesTaken`** in `RetryContext`
  - This clarifies the distinction between total attempts and consumed retries
  - Migration: Replace all references to `ctx.retriesConsumed` with `ctx.retriesTaken`

- **Removed `timeMin` option from public API**
  - This option was never implemented but was exposed in the TypeScript interface
  - Migration: Remove any usage of `timeMin` option

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
