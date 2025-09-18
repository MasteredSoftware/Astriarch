<script lang="ts">
	import TopOverviewButton from './TopOverviewButton.svelte';
	import IconImage from '../icon-image/IconImage.svelte';
	import AudioControls from '../../audio/AudioControls.svelte';
	import { audioStatus } from '$lib/stores/audioStore';

	interface Props {
		disabled?: boolean;
		class?: string;
		[key: string]: any;
	}

	let { disabled = false, class: className, ...restProps }: Props = $props();

	let showAudioControls = $state(false);
	let buttonElement: HTMLElement;

	function handleVolumeClick() {
		showAudioControls = !showAudioControls;
	}

	// Close audio controls when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (buttonElement && !buttonElement.contains(event.target as Node)) {
			showAudioControls = false;
		}
	}

	// Add/remove click outside listener
	$effect(() => {
		if (showAudioControls) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});
</script>

<div bind:this={buttonElement} class="relative {className || ''}" {...restProps}>
	<TopOverviewButton
		onclick={handleVolumeClick}
		{disabled}
		title={$audioStatus.muted ? 'Unmute Audio' : 'Mute Audio'}
	>
		<IconImage
			type={$audioStatus.muted ? 'volume_muted' : 'volume'}
			size={24}
			altText={$audioStatus.muted ? 'Volume Muted' : 'Volume'}
		/>
	</TopOverviewButton>

	<!-- AudioControls Popup -->
	{#if showAudioControls}
		<div class="absolute top-full left-0 z-50 mt-2">
			<AudioControls showVolumeSlider={true} compact={false} position="top-left" />
		</div>
	{/if}
</div>

<style>
	/* Override the default positioning of AudioControls since we're controlling it */
	:global(.audio-controls) {
		position: relative !important;
		top: auto !important;
		left: auto !important;
		right: auto !important;
		bottom: auto !important;
	}
</style>
