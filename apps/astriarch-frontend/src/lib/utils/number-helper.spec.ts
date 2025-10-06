import { describe, it, expect } from 'vitest';
import { toShortNumberString } from './number-helper';

describe('toShortNumberString', () => {
	describe('special cases', () => {
		it('should handle zero', () => {
			expect(toShortNumberString(0)).toBe('0');
		});

		it('should handle infinity', () => {
			expect(toShortNumberString(Infinity)).toBe('Infinity');
			expect(toShortNumberString(-Infinity)).toBe('-Infinity');
		});

		it('should handle NaN', () => {
			expect(toShortNumberString(NaN)).toBe('NaN');
		});
	});

	describe('numbers less than 1000', () => {
		it('should show 1 decimal place for small positive numbers', () => {
			expect(toShortNumberString(0.1)).toBe('0.1');
			expect(toShortNumberString(1)).toBe('1.0');
			expect(toShortNumberString(42.7)).toBe('42.7');
			expect(toShortNumberString(123.456)).toBe('123.5'); // rounded
			expect(toShortNumberString(999.9)).toBe('999.9');
		});

		it('should show 1 decimal place for small negative numbers', () => {
			expect(toShortNumberString(-0.1)).toBe('-0.1');
			expect(toShortNumberString(-42.7)).toBe('-42.7');
			expect(toShortNumberString(-123.456)).toBe('-123.5'); // rounded
			expect(toShortNumberString(-999.9)).toBe('-999.9');
		});

		it('should handle edge case just below 1000', () => {
			expect(toShortNumberString(999.99)).toBe('1000.0');
		});
	});

	describe('thousands (K)', () => {
		it('should format thousands with K suffix', () => {
			expect(toShortNumberString(1000)).toBe('1.0K');
			expect(toShortNumberString(1123.2)).toBe('1.1K');
			expect(toShortNumberString(1500)).toBe('1.5K');
			expect(toShortNumberString(9999)).toBe('10.0K');
			expect(toShortNumberString(50000)).toBe('50.0K');
			expect(toShortNumberString(999999)).toBe('1000.0K');
		});

		it('should format negative thousands with K suffix', () => {
			expect(toShortNumberString(-1000)).toBe('-1.0K');
			expect(toShortNumberString(-1500)).toBe('-1.5K');
			expect(toShortNumberString(-50000)).toBe('-50.0K');
		});
	});

	describe('millions (M)', () => {
		it('should format millions with M suffix', () => {
			expect(toShortNumberString(1000000)).toBe('1.0M');
			expect(toShortNumberString(2456789)).toBe('2.5M');
			expect(toShortNumberString(15000000)).toBe('15.0M');
			expect(toShortNumberString(999999999)).toBe('1000.0M');
		});

		it('should format negative millions with M suffix', () => {
			expect(toShortNumberString(-1000000)).toBe('-1.0M');
			expect(toShortNumberString(-2456789)).toBe('-2.5M');
			expect(toShortNumberString(-15000000)).toBe('-15.0M');
		});
	});

	describe('billions (B)', () => {
		it('should format billions with B suffix', () => {
			expect(toShortNumberString(1000000000)).toBe('1.0B');
			expect(toShortNumberString(3789123456)).toBe('3.8B');
			expect(toShortNumberString(15000000000)).toBe('15.0B');
			expect(toShortNumberString(999999999999)).toBe('1000.0B');
		});

		it('should format negative billions with B suffix', () => {
			expect(toShortNumberString(-1000000000)).toBe('-1.0B');
			expect(toShortNumberString(-3789123456)).toBe('-3.8B');
		});
	});

	describe('trillions (T)', () => {
		it('should format trillions with T suffix', () => {
			expect(toShortNumberString(1000000000000)).toBe('1.0T');
			expect(toShortNumberString(4567890123456)).toBe('4.6T');
			expect(toShortNumberString(15000000000000)).toBe('15.0T');
		});

		it('should format negative trillions with T suffix', () => {
			expect(toShortNumberString(-1000000000000)).toBe('-1.0T');
			expect(toShortNumberString(-4567890123456)).toBe('-4.6T');
		});

		it('should handle very large numbers', () => {
			expect(toShortNumberString(1234567890123456)).toBe('1234.6T');
		});
	});

	describe('rounding behavior', () => {
		it('should round to 1 decimal place correctly', () => {
			expect(toShortNumberString(1149)).toBe('1.1K'); // 1.149K rounds to 1.1K
			expect(toShortNumberString(1151)).toBe('1.2K'); // 1.151K rounds to 1.2K
			expect(toShortNumberString(1234567)).toBe('1.2M'); // 1.234567M rounds to 1.2M
			expect(toShortNumberString(1250000)).toBe('1.3M'); // 1.25M rounds to 1.3M
		});
	});

	describe('boundary conditions', () => {
		it('should handle exact boundary values', () => {
			expect(toShortNumberString(999.99999)).toBe('1000.0');
			expect(toShortNumberString(999999.99999)).toBe('1000.0K');
			expect(toShortNumberString(999999999.99999)).toBe('1000.0M');
			expect(toShortNumberString(999999999999)).toBe('1000.0B');
		});
	});
});
