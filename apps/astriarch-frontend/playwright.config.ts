import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Astriarch E2E tests.
 *
 * Prerequisites (run before `test:e2e`):
 *   docker-compose up -d mongodb   (or have Mongo already running on port 27017)
 *
 * The config starts both the backend and the frontend dev servers automatically
 * when running Playwright, so you do NOT need to start them manually.
 *
 * Port assignments (deliberately non-overlapping with normal dev ports):
 *   Frontend : http://localhost:4173  (Vite preview)
 *   Backend  : http://localhost:8002  (test-only instance)
 *
 * Environment variables used:
 *   PUBLIC_BACKEND_HTTP_URL  – backend HTTP base URL for the frontend
 *   PUBLIC_BACKEND_WS_URL    – backend WS URL for the frontend
 *   TEST_BACKEND_PORT        – port the backend listens on (default 8002)
 */

const BACKEND_PORT = process.env.TEST_BACKEND_PORT ?? '8002';
const BACKEND_HTTP = `http://localhost:${BACKEND_PORT}`;
const BACKEND_WS = `ws://localhost:${BACKEND_PORT}`;
const FRONTEND_PORT = '4173';
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	// Run scenario files in parallel; tests within a file run serially by default.
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [['html', { open: 'never' }], ['list']],

	use: {
		baseURL: FRONTEND_URL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'on-first-retry'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	webServer: [
		// 1. Backend — started first so it is ready when the frontend connects.
		{
			command: `pnpm --filter astriarch-engine build && PORT=${BACKEND_PORT} NODE_ENV=test pnpm --filter astriarch-backend dev`,
			url: `${BACKEND_HTTP}/api/health`,
			timeout: 90_000,
			reuseExistingServer: !process.env.CI,
			env: {
				PORT: BACKEND_PORT,
				WS_PORT: BACKEND_PORT,
				NODE_ENV: 'test',
				// Inherit Mongo connection from environment or fall back to local dev DB.
				MONGODB_CONNECTION_STRING:
					process.env.MONGODB_CONNECTION_STRING ?? 'mongodb://localhost:27017/astriarch_v2_test'
			}
		},
		// 2. Frontend — uses Vite dev server on a dedicated port, pointed at the test backend.
		{
			command: `PUBLIC_BACKEND_HTTP_URL=${BACKEND_HTTP} PUBLIC_BACKEND_WS_URL=${BACKEND_WS} pnpm --filter astriarch-frontend dev --port ${FRONTEND_PORT}`,
			url: FRONTEND_URL,
			timeout: 30_000,
			reuseExistingServer: !process.env.CI
		}
	]
});
