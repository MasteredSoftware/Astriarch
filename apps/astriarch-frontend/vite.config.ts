import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import checker from 'vite-plugin-checker';
import { isMainThread } from 'node:worker_threads';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: true
			})
		}),
		// SvelteKit 3 re-loads this config in a worker thread for route analysis;
		// vite-plugin-checker assumes any worker thread is its own and crashes there
		isMainThread &&
			checker({
				typescript: true
			})
	],
	test: {
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				// Unit tests for the Node-side perf harness helpers (e2e/perf). Playwright
				// ignores these specs (testIgnore in playwright.config.ts).
				test: {
					name: 'perf-harness',
					environment: 'node',
					include: ['e2e/perf/**/*.spec.ts']
				}
			}
		]
	}
});
