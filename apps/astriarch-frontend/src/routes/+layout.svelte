<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { enableAudioOnFirstInteraction } from '$lib/stores/audioStore';

	let { children } = $props();

	onMount(() => {
		if (browser) {
			// Enable audio system to respond to user interactions
			enableAudioOnFirstInteraction();
		}
	});
</script>

{@render children()}
