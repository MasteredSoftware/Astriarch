<script lang="ts">
	import { audioActions, audioStatus } from '$lib/stores/audioStore';

	// Component props for customization
	interface Props {
		showVolumeSlider?: boolean;
		compact?: boolean;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	}

	let { showVolumeSlider = true, compact = false, position = 'top-right' }: Props = $props();

	// Local state for volume slider
	let volumeValue = $state($audioStatus.volume);
	let showVolumePanel = $state(false);

	// Update volume value when store changes
	$effect(() => {
		volumeValue = $audioStatus.volume;
	});

	function handleMuteToggle() {
		audioActions.toggleMute();
	}

	function handleVolumeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const newVolume = parseFloat(target.value);
		volumeValue = newVolume;
		audioActions.setVolume(newVolume);
	}

	function toggleVolumePanel() {
		showVolumePanel = !showVolumePanel;
	}

	// Position classes
	const positionClasses = {
		'top-left': 'top-4 left-4',
		'top-right': 'top-4 right-4',
		'bottom-left': 'bottom-4 left-4',
		'bottom-right': 'bottom-4 right-4'
	};
</script>

<div class="audio-controls {positionClasses[position]} {compact ? 'compact' : ''}">
	<!-- Main audio controls -->
	<div class="controls-container">
		<!-- Mute/Volume Button -->
		<button
			class="audio-button"
			onclick={handleMuteToggle}
			title={$audioStatus.muted ? 'Unmute Audio' : 'Mute Audio'}
			aria-label={$audioStatus.muted ? 'Unmute Audio' : 'Mute Audio'}
		>
			{#if $audioStatus.muted}
				<!-- Muted speaker icon -->
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
					<line x1="23" y1="9" x2="17" y2="15"></line>
					<line x1="17" y1="9" x2="23" y2="15"></line>
				</svg>
			{:else}
				<!-- Normal speaker icon -->
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
					{#if $audioStatus.volume > 0.5}
						<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
					{:else if $audioStatus.volume > 0}
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
					{/if}
				</svg>
			{/if}
		</button>

		<!-- Volume Slider (if not compact) -->
		{#if showVolumeSlider && !compact}
			<div class="volume-slider-container">
				<input
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={volumeValue}
					oninput={handleVolumeChange}
					class="volume-slider"
					title="Volume: {$audioStatus.volumePercent}%"
					aria-label="Volume Control"
				/>
			</div>
		{/if}

		<!-- Volume Panel Toggle (compact mode) -->
		{#if compact}
			<button
				class="volume-toggle-button"
				onclick={toggleVolumePanel}
				title="Volume Settings"
				aria-label="Volume Settings"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="3"></circle>
					<path
						d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"
					></path>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Volume Panel (compact mode) -->
	{#if compact && showVolumePanel}
		<div class="volume-panel">
			<div class="volume-panel-content">
				<label for="volume-slider-panel" class="volume-label">
					Volume: {$audioStatus.volumePercent}%
				</label>
				<input
					id="volume-slider-panel"
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={volumeValue}
					oninput={handleVolumeChange}
					class="volume-slider-panel"
				/>
				<div class="audio-phase-info">
					Phase: {$audioStatus.phase}
				</div>
			</div>
		</div>
	{/if}

	<!-- Audio Status Indicator (when disabled) -->
	{#if !$audioStatus.enabled}
		<div class="audio-disabled-indicator" title="Audio is disabled">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="15" y1="9" x2="9" y2="15"></line>
				<line x1="9" y1="9" x2="15" y2="15"></line>
			</svg>
		</div>
	{/if}
</div>

<style>
	.audio-controls {
		position: fixed;
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.controls-container {
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(0, 20, 40, 0.95);
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 8px;
		padding: 8px;
		box-shadow: 0 4px 12px rgba(0, 255, 255, 0.2);
		backdrop-filter: blur(4px);
	}

	.compact .controls-container {
		padding: 6px;
		gap: 4px;
	}

	.audio-button,
	.volume-toggle-button {
		background: transparent;
		border: none;
		color: #00ffff;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.audio-button:hover,
	.volume-toggle-button:hover {
		background: rgba(0, 255, 255, 0.1);
		color: #ffffff;
	}

	.audio-button:active,
	.volume-toggle-button:active {
		transform: scale(0.95);
	}

	.volume-slider-container {
		display: flex;
		align-items: center;
	}

	.volume-slider {
		width: 80px;
		height: 4px;
		background: rgba(0, 255, 255, 0.2);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
	}

	.volume-slider::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		background: #00ffff;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid #ffffff;
		transition: all 0.2s ease;
	}

	.volume-slider::-webkit-slider-thumb:hover {
		background: #ffffff;
		border-color: #00ffff;
	}

	.volume-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #00ffff;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid #ffffff;
		transition: all 0.2s ease;
	}

	.volume-panel {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		background: rgba(0, 0, 0, 0.9);
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 6px;
		padding: 12px;
		min-width: 200px;
		backdrop-filter: blur(4px);
	}

	.volume-panel-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.volume-label {
		color: #00ffff;
		font-size: 12px;
		font-weight: 600;
	}

	.volume-slider-panel {
		width: 100%;
		height: 4px;
		background: rgba(0, 255, 255, 0.2);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
	}

	.volume-slider-panel::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		background: #00ffff;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid #ffffff;
	}

	.volume-slider-panel::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #00ffff;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid #ffffff;
	}

	.audio-phase-info {
		color: rgba(0, 255, 255, 0.7);
		font-size: 10px;
		text-align: center;
		font-family: 'Orbitron', monospace;
	}

	.audio-disabled-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 0, 0, 0.2);
		border: 1px solid rgba(255, 0, 0, 0.5);
		border-radius: 50%;
		width: 24px;
		height: 24px;
		color: #ff6b6b;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.volume-slider {
			width: 60px;
		}

		.volume-panel {
			min-width: 160px;
		}
	}
</style>
