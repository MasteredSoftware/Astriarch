/**
 * Test cleanup helper — calls the backend test-cleanup endpoint to remove
 * games and sessions created by E2E tests, keeping runs isolated.
 */

const BACKEND_PORT = process.env.TEST_BACKEND_PORT ?? '8002';
const CLEANUP_URL = `http://localhost:${BACKEND_PORT}/api/test/cleanup`;

export async function cleanupTestData(prefix = '__e2e__'): Promise<void> {
	try {
		const res = await fetch(CLEANUP_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prefix })
		});
		if (!res.ok) {
			console.warn(`[e2e cleanup] HTTP ${res.status} — test data may not have been cleaned up.`);
		}
	} catch (err) {
		console.warn('[e2e cleanup] Could not reach cleanup endpoint:', err);
	}
}

/** Unique game name scoped to the current test run, with the e2e prefix. */
export function testGameName(suffix: string): string {
	return `__e2e__${suffix}_${Date.now()}`;
}
