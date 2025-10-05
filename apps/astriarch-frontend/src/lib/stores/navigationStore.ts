import { writable } from 'svelte/store';

export type GameView = 'planets' | 'fleet' | 'research' | 'trading' | 'activity';

export const currentView = writable<GameView>('planets');

export const navigationActions = {
	setView(view: GameView) {
		currentView.set(view);
	}
};
