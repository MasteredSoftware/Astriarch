<script lang="ts">
	import TopOverviewButton from './TopOverviewButton.svelte';
	import type { GameSpeed } from 'astriarch-engine';
	import { currentGameSpeedNumber, gameActions } from '$lib/stores/gameStore';

	interface Props {
		disabled?: boolean;
		class?: string;
		[key: string]: any;
	}

	let { disabled = false, class: className, ...restProps }: Props = $props();

	let showSpeedPanel = $state(false);
	let buttonElement: HTMLElement;

	function handleSpeedClick() {
		showSpeedPanel = !showSpeedPanel;
	}

	// Close speed panel when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (buttonElement && !buttonElement.contains(event.target as Node)) {
			showSpeedPanel = false;
		}
	}

	// Add/remove click outside listener
	$effect(() => {
		if (showSpeedPanel) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});

	function handleSpeedChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const newSpeed = parseInt(target.value);
		// Use the centralized game action
		gameActions.setGameSpeed(newSpeed);
	}
</script>

<div bind:this={buttonElement} class="relative {className || ''}" {...restProps}>
	<TopOverviewButton
		onclick={handleSpeedClick}
		{disabled}
		title="Game Speed: {$currentGameSpeedNumber}"
	>
		<!-- Clock icon with speed number -->
		<div class="speed-indicator">
			<div class="speed-circle">
				{$currentGameSpeedNumber}
			</div>
		</div>
	</TopOverviewButton>

	<!-- Speed Control Panel -->
	{#if showSpeedPanel}
		<div class="absolute left-0 z-50">
			<div class="speed-panel">
				<div class="speed-panel-content">
					<label for="speed-slider" class="speed-label">
						Game Speed: {$currentGameSpeedNumber}
					</label>
					<input
						id="speed-slider"
						type="range"
						min="1"
						max="5"
						step="1"
						value={$currentGameSpeedNumber}
						oninput={handleSpeedChange}
						class="speed-slider"
					/>
					<div class="speed-marks">
						<span>1</span>
						<span>2</span>
						<span>3</span>
						<span>4</span>
						<span>5</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.speed-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
	}

	.speed-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: 2px solid currentColor;
		border-radius: 50%;
		font-size: 12px;
		font-weight: bold;
		color: #00ffff;
	}

	.speed-panel {
		position: relative;
		background: rgba(0, 20, 40, 0.95);
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 8px;
		padding: 8px;
		min-width: 200px;
		box-shadow: 0 4px 12px rgba(0, 255, 255, 0.2);
		backdrop-filter: blur(4px);
	}

	.speed-panel-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.speed-label {
		color: #00ffff;
		font-size: 14px;
		font-weight: 500;
		text-align: center;
	}

	.speed-slider {
		width: 100%;
		height: 6px;
		background: rgba(0, 255, 255, 0.2);
		border-radius: 3px;
		outline: none;
		cursor: pointer;
	}

	.speed-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: #00ffff;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid #001428;
	}

	.speed-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #00ffff;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid #001428;
	}

	.speed-marks {
		display: flex;
		justify-content: space-between;
		margin-top: -8px;
		margin-bottom: 8px;
		font-size: 12px;
		color: #7dd3fc;
	}

	.save-button {
		background: #00ffff;
		color: #001428;
		border: none;
		border-radius: 4px;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.save-button:hover {
		background: #7dd3fc;
	}

	.save-button:active {
		background: #0891b2;
	}
</style>
