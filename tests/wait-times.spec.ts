import { retry } from "../src";

const flushPromises = () =>
	new Promise(resolve => jest.requireActual("timers").setImmediate(resolve));

/**
 * We use jest fake timers to verify exact wait times.
 * This ensures that backoff strategies (linear, exponential) and limits (waitMin, waitMax) work as expected.
 */

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <jest>
describe("retry wait times", () => {
	beforeAll(() => {
		jest.useFakeTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it("should wait for waitMin by default (constant backoff)", async () => {
		const WAIT_MIN = 1000;
		let tries = 0;

		const promise = retry(
			"safe",
			() => {
				tries++;
				throw new Error("fail");
			},
			{ retries: 2, waitMin: WAIT_MIN, waitMax: 5000, linear: false }
		);

		// 1st try (immediate)
		await flushPromises();
		expect(tries).toBe(1);

		// Wait for 1st retry
		// Should wait WAIT_MIN ms
		await jest.advanceTimersByTimeAsync(WAIT_MIN);
		expect(tries).toBe(2);

		// Wait for 2nd retry
		await jest.advanceTimersByTimeAsync(WAIT_MIN);
		expect(tries).toBe(3);

		try {
			await promise;
		} catch {
			// ignore expected error
		}
	});

	it("should apply linear backoff", async () => {
		const WAIT_MIN = 100;
		let tries = 0;

		const promise = retry(
			"safe",
			() => {
				tries++;
				throw new Error("fail");
			},
			{
				retries: 3,
				waitMin: WAIT_MIN,
				linear: true,
				random: false, // disable random for deterministic testing
				factor: 1 // disable exponential
			}
		);

		// 1st attempt & 2nd attempt (1st retry with wait=0) happen immediately
		await flushPromises();
		expect(tries).toBe(2);

		// 2nd retry (triesConsumed=1): wait = waitMin * 1 = 100
		await jest.advanceTimersByTimeAsync(WAIT_MIN);
		expect(tries).toBe(3);

		// 3rd retry (triesConsumed=2): wait = waitMin * 2 = 200
		await jest.advanceTimersByTimeAsync(WAIT_MIN * 2);
		expect(tries).toBe(4);

		try {
			await promise;
		} catch {
			// ignore expected error
		}
	});

	it("should apply exponential backoff", async () => {
		const WAIT_MIN = 100;
		const FACTOR = 2;
		let tries = 0;

		const promise = retry(
			"safe",
			() => {
				tries++;
				throw new Error("fail");
			},
			{
				retries: 3,
				waitMin: WAIT_MIN,
				factor: FACTOR,
				linear: false,
				random: false
			}
		);

		// 1st attempt
		await flushPromises();
		expect(tries).toBe(1);

		// 2nd attempt (1st retry): wait = waitMin * factor^(1-1) = 100 * 1 = 100
		await jest.advanceTimersByTimeAsync(WAIT_MIN);
		expect(tries).toBe(2);

		// 3rd attempt (2nd retry): wait = waitMin * factor^(2-1) = 100 * 2 = 200
		await jest.advanceTimersByTimeAsync(WAIT_MIN * FACTOR);
		expect(tries).toBe(3);

		// 4th attempt (3rd retry): wait = waitMin * factor^(3-1) = 100 * 4 = 400
		await jest.advanceTimersByTimeAsync(WAIT_MIN * FACTOR * FACTOR);
		expect(tries).toBe(4);

		try {
			await promise;
		} catch {
			// ignore expected error
		}
	});

	it("should respect waitMax", async () => {
		const WAIT_MIN = 100;
		const WAIT_MAX = 150;
		const FACTOR = 10; // Growing fast
		let tries = 0;

		const promise = retry(
			"safe",
			() => {
				tries++;
				throw new Error("fail");
			},
			{
				retries: 2,
				waitMin: WAIT_MIN,
				waitMax: WAIT_MAX,
				factor: FACTOR,
				random: false,
				linear: false
			}
		);

		// 1st attempt
		await flushPromises();
		expect(tries).toBe(1);

		// 2nd attempt: wait calculated ~100.
		await jest.advanceTimersByTimeAsync(WAIT_MIN);
		expect(tries).toBe(2);

		// 3rd attempt: wait calculated 100 * 10 = 1000. Cap at WAIT_MAX (150).
		await jest.advanceTimersByTimeAsync(WAIT_MAX);
		expect(tries).toBe(3);

		try {
			await promise;
		} catch {
			// ignore expected error
		}
	});

	it("should not wait longer than timeRemaining", async () => {
		// If timeMax is close, wait time should be shortened
		const TIME_MAX = 200;
		const WAIT_MIN = 500; // > TIME_MAX
		let tries = 0;

		// Mock performance.now to control time flow for timeMax checks
		const originalNow = performance.now;
		let mockedNow = 0;
		global.performance.now = () => mockedNow;

		const promise = retry(
			"safe",
			() => {
				tries++;
				throw new Error("fail");
			},
			{
				retries: 1,
				waitMin: WAIT_MIN,
				timeMax: TIME_MAX,
				linear: false
			}
		);

		// 1st attempt at t=0
		await flushPromises();
		expect(tries).toBe(1);

		// At this point, we are at t=0 relative to start.

		// We advance time to simulate the wait
		// Update mocked time so getTimeRemaining sees 0 at the end
		mockedNow = TIME_MAX; // Update mocked time so getTimeRemaining sees 0 at the end
		await jest.advanceTimersByTimeAsync(TIME_MAX);

		// Should have retried by now because wait was capped at timeRemaining

		// Wait for it to process
		await flushPromises();

		try {
			await promise;
		} catch {
			// ignore expected error
		}

		expect(tries).toBe(2); // Should have retried once just as time expired

		global.performance.now = originalNow;
	});
});
