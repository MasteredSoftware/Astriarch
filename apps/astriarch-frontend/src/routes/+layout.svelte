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

			// Test-only page hook for Playwright; the chunk is only fetched when an
			// init script sets this flag before the app loads.
			if (window.__ASTRIARCH_TEST__ === true) {
				import('#lib/testing/testHooks.ts')
					.then((m) => m.installTestHooks())
					.catch((e) => console.error('[test] hook load failed', e));
			}
		}
	});
</script>

{@render children()}
