import { writable, readable, derived } from 'svelte/store';
import { audioService, type GamePhase } from '$lib/services/audioService';

// Audio service state stores - with safe defaults for SSR
export const isAudioEnabled = writable(audioService?.isEnabled() ?? false);
export const isAudioMuted = writable(audioService?.isMuted() ?? false);
export const audioVolume = writable(audioService?.getVolume() ?? 1.0);
export const currentAudioPhase = writable<GamePhase>(
	audioService?.getCurrentPhase() ?? 'StartMenu'
);

// Audio service actions
export const audioActions = {
	toggleMute: () => {
		if (!audioService) return false;
		const muted = audioService.toggleMute();
		isAudioMuted.set(muted);
		return muted;
	},

	setVolume: (volume: number) => {
		if (!audioService) return;
		audioService.setVolume(volume);
		audioVolume.set(volume);
	},

	startMenu: () => {
		if (!audioService) return;
		audioService.startMenu();
		currentAudioPhase.set('StartMenu');
	},

	beginGame: () => {
		if (!audioService) return;
		audioService.beginGame();
		currentAudioPhase.set('InGame');
	},

	endGame: () => {
		if (!audioService) return;
		audioService.endGame();
		currentAudioPhase.set('GameOver');
	},

	playTurnStart: () => {
		if (!audioService) return;
		audioService.playTurnStart();
	},

	playTurnEnd: () => {
		if (!audioService) return;
		audioService.playTurnEnd();
	},

	enableAudio: () => {
		if (!audioService) return;
		audioService.enableUserInteraction();
		// Also explicitly start menu music to ensure it plays after user interaction
		audioService.startMenu();
		isAudioEnabled.set(true);
	}
};

// Derived store for audio status display
export const audioStatus = derived(
	[isAudioEnabled, isAudioMuted, audioVolume, currentAudioPhase],
	([$isEnabled, $isMuted, $volume, $phase]) => ({
		enabled: $isEnabled,
		muted: $isMuted,
		volume: $volume,
		phase: $phase,
		volumePercent: Math.round($volume * 100)
	})
);

// Browser compatibility check
export const audioSupported = readable(
	typeof window !== 'undefined' && typeof Audio !== 'undefined',
	() => {
		// No cleanup needed for this static check
	}
);

// Auto-enable audio on first user interaction (required for modern browsers)
let hasUserInteracted = false;

export function enableAudioOnFirstInteraction() {
	// Only run in browser environment
	if (typeof window === 'undefined' || typeof document === 'undefined') return;

	if (hasUserInteracted) return;

	const enableAudio = () => {
		if (!hasUserInteracted) {
			hasUserInteracted = true;
			audioActions.enableAudio();

			// Remove listeners after first interaction
			document.removeEventListener('click', enableAudio);
			document.removeEventListener('touchstart', enableAudio);
			document.removeEventListener('keydown', enableAudio);
		}
	};

	// Listen for various user interaction events
	document.addEventListener('click', enableAudio, { once: true });
	document.addEventListener('touchstart', enableAudio, { once: true });
	document.addEventListener('keydown', enableAudio, { once: true });
}
