import { writable } from 'svelte/store';

export interface FleetCommandState {
	isSelectingDestination: boolean;
	sourcePlanetId: number | null;
	selectedShipIds: Set<number>;
	destinationPlanetId: number | null;
}

const initialState: FleetCommandState = {
	isSelectingDestination: false,
	sourcePlanetId: null,
	selectedShipIds: new Set(),
	destinationPlanetId: null
};

function createFleetCommandStore() {
	const { subscribe, set, update } = writable(initialState);

	return {
		subscribe,

		// Actions
		startSelectingDestination: (sourcePlanetId: number, selectedShipIds: Set<number>) =>
			update((state) => ({
				...state,
				isSelectingDestination: true,
				sourcePlanetId,
				selectedShipIds: new Set(selectedShipIds),
				destinationPlanetId: null
			})),

		setDestinationPlanet: (destinationPlanetId: number) =>
			update((state) => ({
				...state,
				destinationPlanetId,
				isSelectingDestination: false
			})),

		cancelDestinationSelection: () =>
			update((state) => ({
				...state,
				isSelectingDestination: false,
				destinationPlanetId: null
			})),

		reset: () => set(initialState)
	};
}

export const fleetCommandStore = createFleetCommandStore();
