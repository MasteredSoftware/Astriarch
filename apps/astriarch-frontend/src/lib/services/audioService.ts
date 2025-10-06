export type GamePhase = 'StartMenu' | 'InGame' | 'GameOver';

export interface AudioTrack {
	element: HTMLAudioElement;
	name: string;
	loop: boolean;
}

export class AudioService {
	private volume = 1.0;
	private muted = false;
	private enabled = true;
	private currentPhase: GamePhase = 'StartMenu';
	private currentInGameTrack = 0;
	private fadingPlayer: HTMLAudioElement | null = null;

	// Audio tracks
	private tracks: Map<string, AudioTrack> = new Map();

	constructor(enabled = true) {
		this.enabled = enabled;
		// Only initialize audio tracks if we're in the browser
		if (typeof window !== 'undefined' && typeof document !== 'undefined') {
			this.initializeAudioTracks();
		}
	}

	private initializeAudioTracks() {
		if (!this.enabled || typeof document === 'undefined') return;

		// Background music - don't auto-play menu music to avoid browser blocking
		this.createAudioTrack('menu-start', 'audio/menu-start', true, false, false);
		this.createAudioTrack('in-game1', 'audio/in-game1', false, true);
		this.createAudioTrack('in-game2', 'audio/in-game2', false, true);
		this.createAudioTrack('in-game3', 'audio/in-game3', false, true);
		this.createAudioTrack('in-game4', 'audio/in-game4', false, true);
		this.createAudioTrack('game-over', 'audio/game-over', true, false);

		// Sound effects
		this.createAudioTrack('turn-start', 'audio/sfx-turn-start', false, false);
		this.createAudioTrack('turn-end', 'audio/sfx-turn-end', false, false);
	}

	private createAudioTrack(
		name: string,
		fileName: string,
		loop: boolean,
		addEndedEvent: boolean,
		playImmediately = false
	) {
		if (typeof document === 'undefined') return;

		const audioElement = document.createElement('audio');
		audioElement.loop = loop;
		audioElement.controls = false;
		audioElement.preload = 'auto';

		// Support both OGG and MP3 formats
		const supportsOgg = audioElement.canPlayType('audio/ogg; codecs="vorbis"');
		const extension = supportsOgg ? 'ogg' : 'mp3';
		audioElement.src = `${fileName}.${extension}`;

		if (playImmediately) {
			audioElement.addEventListener(
				'canplaythrough',
				() => {
					audioElement.play().catch((error) => {
						console.warn('Audio autoplay blocked:', error);
					});
				},
				false
			);
		}

		if (addEndedEvent) {
			audioElement.addEventListener(
				'ended',
				() => {
					this.onMediaEnded();
				},
				false
			);
		}

		// Attempt to preload
		audioElement.load();

		this.tracks.set(name, {
			element: audioElement,
			name,
			loop
		});
	}

	private onMediaEnded() {
		if (this.currentPhase === 'InGame') {
			this.currentInGameTrack++;
			if (this.currentInGameTrack >= 4) {
				this.currentInGameTrack = 0;
			}
		}

		const currentTrack = this.getCurrentTrack();
		if (currentTrack) {
			currentTrack.element.currentTime = 0;
			currentTrack.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
			currentTrack.element.volume = this.volume;
		}
	}

	private getCurrentTrack(): AudioTrack | undefined {
		if (!this.enabled) return undefined;

		switch (this.currentPhase) {
			case 'StartMenu':
				return this.tracks.get('menu-start');
			case 'GameOver':
				return this.tracks.get('game-over');
			case 'InGame': {
				const trackNames = ['in-game1', 'in-game2', 'in-game3', 'in-game4'];
				return this.tracks.get(trackNames[this.currentInGameTrack]);
			}
			default:
				return undefined;
		}
	}

	private fadeOutTick() {
		if (!this.enabled || !this.fadingPlayer) return;

		if (this.fadingPlayer.volume <= 0.1) {
			this.fadingPlayer.volume = 0;
			this.fadingPlayer.pause();
			this.fadingPlayer.currentTime = 0;
			this.fadingPlayer = null;
		} else {
			this.fadingPlayer.volume = Math.max(0, this.fadingPlayer.volume - 0.1);
			setTimeout(() => this.fadeOutTick(), 100);
		}
	}

	private startFadeOut() {
		const currentTrack = this.getCurrentTrack();
		if (currentTrack) {
			this.fadingPlayer = currentTrack.element;
			setTimeout(() => this.fadeOutTick(), 100);
		}
	}

	// Public methods
	toggleMute(): boolean {
		this.muted = !this.muted;

		if (this.enabled) {
			this.tracks.forEach((track) => {
				track.element.muted = this.muted;
			});
		}

		return this.muted;
	}

	setVolume(volume: number) {
		this.volume = Math.max(0, Math.min(1, volume));

		const currentTrack = this.getCurrentTrack();
		if (currentTrack) {
			currentTrack.element.volume = this.volume;
		}
	}

	getVolume(): number {
		return this.volume;
	}

	isMuted(): boolean {
		return this.muted;
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getCurrentPhase(): GamePhase {
		return this.currentPhase;
	}

	// Enable audio after user interaction
	enableUserInteraction() {
		// This method should be called after the first user interaction
		// to enable audio playback in browsers that require user gesture
		if (this.currentPhase === 'StartMenu') {
			this.startMenu();
		}
	}

	// Phase transitions
	startMenu() {
		if (!this.enabled) {
			console.log('AudioService: startMenu() called but audio not enabled');
			return;
		}

		console.log('AudioService: startMenu() called, currentPhase:', this.currentPhase);

		// Only fade out if we're switching from a different phase
		if (this.currentPhase !== 'StartMenu') {
			this.startFadeOut();
		}

		this.currentPhase = 'StartMenu';

		const track = this.tracks.get('menu-start');
		if (track) {
			console.log('AudioService: Found menu-start track, attempting to play...');
			track.element.currentTime = 0;
			track.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
			track.element.volume = this.volume;
			console.log('AudioService: Menu track volume set to:', this.volume);
		} else {
			console.warn('AudioService: menu-start track not found!');
		}
	}

	beginGame() {
		if (!this.enabled) return;

		// Only fade out if we're switching from a different phase
		if (this.currentPhase !== 'InGame') {
			this.startFadeOut();
		}

		this.currentPhase = 'InGame';
		this.currentInGameTrack = 0;

		const track = this.tracks.get('in-game1');
		if (track) {
			track.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
			track.element.volume = this.volume;
		}
	}

	endGame() {
		if (!this.enabled) return;

		// Only fade out if we're switching from a different phase
		if (this.currentPhase !== 'GameOver') {
			this.startFadeOut();
		}

		this.currentPhase = 'GameOver';

		const track = this.tracks.get('game-over');
		if (track) {
			track.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
			track.element.volume = this.volume;
		}
	}

	// Sound effects
	playTurnStart() {
		if (!this.enabled || this.muted) return;

		const track = this.tracks.get('turn-start');
		if (track) {
			track.element.currentTime = 0;
			track.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
			track.element.volume = this.volume;
		}
	}

	playTurnEnd() {
		if (!this.enabled || this.muted) return;

		const track = this.tracks.get('turn-end');
		if (track) {
			track.element.currentTime = 0;
			track.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
			track.element.volume = this.volume;
		}
	}

	// Enable user interaction with audio (required for autoplay policies)
	enableAudio() {
		this.enabled = true;
		// Only initialize if we're in the browser and haven't already initialized
		if (
			typeof window !== 'undefined' &&
			typeof document !== 'undefined' &&
			this.tracks.size === 0
		) {
			this.initializeAudioTracks();
		}

		// Try to play the current phase's audio
		const currentTrack = this.getCurrentTrack();
		if (currentTrack && currentTrack.element.paused) {
			currentTrack.element.play().catch((error) => {
				console.warn('Audio play failed:', error);
			});
		}
	}

	// Cleanup
	destroy() {
		this.tracks.forEach((track) => {
			track.element.pause();
			track.element.src = '';
			track.element.remove();
		});
		this.tracks.clear();
		this.fadingPlayer = null;
	}
}

// Singleton instance - only create in browser environment
let audioServiceInstance: AudioService | null = null;

export const audioService = (() => {
	if (typeof window !== 'undefined' && !audioServiceInstance) {
		audioServiceInstance = new AudioService(true);
	}
	return audioServiceInstance;
})();
