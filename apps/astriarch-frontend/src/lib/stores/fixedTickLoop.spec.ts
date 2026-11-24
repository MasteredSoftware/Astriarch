import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFixedTickLoop } from './fixedTickLoop';

const TICK_MS = 200;

describe('createFixedTickLoop', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does nothing until started', () => {
		const tick = vi.fn(() => true);
		const loop = createFixedTickLoop(tick, TICK_MS);
		vi.advanceTimersByTime(TICK_MS * 5);
		expect(tick).not.toHaveBeenCalled();
		expect(loop.isRunning()).toBe(false);
	});

	it('ticks once per interval', () => {
		const tick = vi.fn(() => true);
		const loop = createFixedTickLoop(tick, TICK_MS);
		loop.start();
		vi.advanceTimersByTime(TICK_MS - 1);
		expect(tick).toHaveBeenCalledTimes(0);
		vi.advanceTimersByTime(1);
		expect(tick).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(TICK_MS * 4);
		expect(tick).toHaveBeenCalledTimes(5);
		expect(loop.isRunning()).toBe(true);
	});

	it('stop clears the interval, and start after stop resumes', () => {
		const tick = vi.fn(() => true);
		const loop = createFixedTickLoop(tick, TICK_MS);
		loop.start();
		vi.advanceTimersByTime(TICK_MS * 2);
		loop.stop();
		expect(loop.isRunning()).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(TICK_MS * 5);
		expect(tick).toHaveBeenCalledTimes(2);

		loop.start();
		vi.advanceTimersByTime(TICK_MS * 3);
		expect(tick).toHaveBeenCalledTimes(5);
	});

	it('stop is safe when not running', () => {
		const loop = createFixedTickLoop(() => true, TICK_MS);
		expect(() => loop.stop()).not.toThrow();
		expect(loop.isRunning()).toBe(false);
	});

	it('ensureRunning twice keeps a single interval', () => {
		const tick = vi.fn(() => true);
		const loop = createFixedTickLoop(tick, TICK_MS);
		// Both store subscribers call this when the model and grid are ready
		loop.ensureRunning();
		loop.ensureRunning();
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(TICK_MS * 3);
		expect(tick).toHaveBeenCalledTimes(3);
	});

	it('ensureRunning does not restart a running loop', () => {
		const tick = vi.fn(() => true);
		const loop = createFixedTickLoop(tick, TICK_MS);
		loop.start();
		vi.advanceTimersByTime(TICK_MS / 2);
		loop.ensureRunning();
		// Still on the original schedule
		vi.advanceTimersByTime(TICK_MS / 2);
		expect(tick).toHaveBeenCalledTimes(1);
	});

	it('start while running restarts without leaving two intervals', () => {
		const tick = vi.fn(() => true);
		const loop = createFixedTickLoop(tick, TICK_MS);
		loop.start();
		vi.advanceTimersByTime(TICK_MS / 2);
		loop.start();
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(TICK_MS / 2);
		expect(tick).toHaveBeenCalledTimes(0);
		vi.advanceTimersByTime(TICK_MS / 2);
		expect(tick).toHaveBeenCalledTimes(1);
	});

	it('stops when a tick returns false, e.g. the game stopped running elsewhere', () => {
		let running = true;
		const tick = vi.fn(() => running);
		const loop = createFixedTickLoop(tick, TICK_MS);
		loop.start();
		vi.advanceTimersByTime(TICK_MS * 2);
		running = false;
		vi.advanceTimersByTime(TICK_MS);
		expect(loop.isRunning()).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(TICK_MS * 5);
		expect(tick).toHaveBeenCalledTimes(3);

		// ensureRunning starts it again once the game resumes
		running = true;
		loop.ensureRunning();
		vi.advanceTimersByTime(TICK_MS);
		expect(tick).toHaveBeenCalledTimes(4);
	});
});
