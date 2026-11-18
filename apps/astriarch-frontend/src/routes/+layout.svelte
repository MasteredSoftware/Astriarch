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
		}
	});
</script>

{@render children()}
