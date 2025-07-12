import { writable } from 'svelte/store';

export type GameView = 'fleet' | 'planets' | 'research' | 'diplomacy';

export const currentView = writable<GameView>('fleet');

export const navigationActions = {
  setView(view: GameView) {
    currentView.set(view);
  }
};
