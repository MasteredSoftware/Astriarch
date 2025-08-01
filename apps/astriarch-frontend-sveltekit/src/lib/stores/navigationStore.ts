import { writable } from 'svelte/store';

export type GameView = 'galaxy' | 'fleet' | 'planets' | 'research' | 'diplomacy';

export const currentView = writable<GameView>('galaxy');

export const navigationActions = {
	setView(view: GameView) {
		currentView.set(view);
	}
};
