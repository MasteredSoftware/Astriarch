/**
 * Formats a number into a short, readable string with appropriate abbreviations.
 * - Numbers < 1000: Shows 1 decimal place (e.g., 123.4)
 * - Numbers >= 1000: Shows abbreviated form with K, M, B, T suffixes (e.g., 1.1K, 2.3M)
 */
export function toShortNumberString(value: number): string {
	// Handle special cases
	if (value === 0) return '0';
	if (!isFinite(value)) return value.toString();
	
	const absValue = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	
	// Less than 1000: show 1 decimal place
	if (absValue < 1000) {
		return sign + absValue.toFixed(1);
	}
	
	// Define the suffixes and their corresponding values
	const suffixes = [
		{ value: 1e12, suffix: 'T' }, // Trillion
		{ value: 1e9, suffix: 'B' },  // Billion
		{ value: 1e6, suffix: 'M' },  // Million
		{ value: 1e3, suffix: 'K' }   // Thousand
	];
	
	// Find the appropriate suffix
	for (const { value: threshold, suffix } of suffixes) {
		if (absValue >= threshold) {
			const scaledValue = absValue / threshold;
			// Show 1 decimal place for the abbreviated form
			return sign + scaledValue.toFixed(1) + suffix;
		}
	}
	
	// Fallback (should never reach here given our logic above)
	return sign + absValue.toFixed(1);
}
