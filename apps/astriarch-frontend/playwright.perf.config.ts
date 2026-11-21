import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for the performance benchmark (e2e/perf).
 * Separate from playwright.config.ts so `test:e2e` is unaffected.
 *
 * Prerequisites:
 *   docker-compose up -d mongodb
 *   pnpm --filter astriarch-frontend exec playwright install chromium firefox
 *
 * Differences from the e2e config:
 *   - The frontend is a production build (`vite build` + `vite preview`), not
 *     the dev server, which adds Svelte dev-mode and HMR overhead.
 *   - Browsers run headed (set PERF_HEADLESS=1 to override) because headless
 *     rendering paths differ, especially for Firefox and GPU canvas.
 *   - The frontend server is never reused, so results always reflect the
 *     current working tree.
 *
 * See e2e/perf/README.md for usage.
 */

const BACKEND_PORT = process.env.TEST_BACKEND_PORT ?? '8002';
const BACKEND_HTTP = `http://localhost:${BACKEND_PORT}`;
const BACKEND_WS = `ws://localhost:${BACKEND_PORT}`;
const FRONTEND_PORT = process.env.PERF_FRONTEND_PORT ?? '4174';
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
	testDir: './e2e/perf',
	testMatch: '**/*.perf.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list']],

	use: {
		baseURL: FRONTEND_URL
	},

	projects: [
		{ name: 'chromium-perf', use: { browserName: 'chromium' } },
		{ name: 'firefox-perf', use: { browserName: 'firefox' } }
	],

	webServer: [
		{
			command: `pnpm --filter astriarch-engine build && PORT=${BACKEND_PORT} NODE_ENV=test pnpm --filter astriarch-backend dev`,
			url: `${BACKEND_HTTP}/api/health`,
			timeout: 90_000,
			reuseExistingServer: true,
			env: {
				PORT: BACKEND_PORT,
				WS_PORT: BACKEND_PORT,
				NODE_ENV: 'test',
				MONGODB_CONNECTION_STRING:
					process.env.MONGODB_CONNECTION_STRING ?? 'mongodb://localhost:27017/astriarch_v2_test'
			}
		},
		{
			command: `pnpm run build && pnpm exec vite preview --port ${FRONTEND_PORT} --strictPort`,
			url: FRONTEND_URL,
			timeout: 300_000,
			reuseExistingServer: false,
			env: {
				PUBLIC_BACKEND_HTTP_URL: BACKEND_HTTP,
				PUBLIC_BACKEND_WS_URL: BACKEND_WS,
				PUBLIC_NODE_ENV: 'production'
			}
		}
	]
});
