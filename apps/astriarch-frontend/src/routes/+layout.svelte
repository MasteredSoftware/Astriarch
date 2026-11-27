<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import { enableAudioOnFirstInteraction } from '#lib/stores/audioStore.ts';
	import { keyboardShortcutService } from '#lib/services/keyboardShortcuts.ts';

	let { children } = $props();

	onMount(() => {
		if (browser) {
			// Enable audio system to respond to user interactions
			enableAudioOnFirstInteraction();

			// Initialize global keyboard shortcut service
			keyboardShortcutService.initialize();

			// Test-only page hook for Playwright. The build-time check lets the bundler
			// drop the chunk from production builds: it is built only under `vite dev`
			// or with VITE_ASTRIARCH_TEST_HOOKS=true, and fetched only when an init
			// script sets window.__ASTRIARCH_TEST__ before the app loads.
			if (
				(import.meta.env.DEV || import.meta.env.VITE_ASTRIARCH_TEST_HOOKS === 'true') &&
				window.__ASTRIARCH_TEST__ === true
			) {
				import('#lib/testing/testHooks.ts')
					.then((m) => m.installTestHooks())
					.catch((e) => console.error('[test] hook load failed', e));
			}
		}
	});
</script>

{@render children()}
