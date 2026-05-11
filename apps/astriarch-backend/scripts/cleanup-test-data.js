#!/usr/bin/env node

const backendPort = process.env.TEST_BACKEND_PORT || '8002';
const prefix = process.env.E2E_PREFIX || '__e2e__';
const cleanupUrl = `http://localhost:${backendPort}/api/test/cleanup`;

async function run() {
	try {
		const res = await fetch(cleanupUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prefix }),
		});

		if (!res.ok) {
			const body = await res.text();
			console.error(`[cleanup-test-data] failed: HTTP ${res.status} ${body}`);
			process.exit(1);
		}

		const body = await res.json();
		console.log('[cleanup-test-data] success', body);
	} catch (err) {
		console.error('[cleanup-test-data] request failed', err);
		process.exit(1);
	}
}

run();
