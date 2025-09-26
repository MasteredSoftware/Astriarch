import { writable } from 'svelte/store';

export interface FleetCommandState {
	isSelectingDestination: boolean;
	sourcePlanetId: number | null;
	selectedShipIds: Set<number>;
	destinationPlanetId: number | null;
	isViewActive: boolean; // Track if Fleet Command View is currently active
}

const initialState: FleetCommandState = {
	isSelectingDestination: false,
	sourcePlanetId: null,
	selectedShipIds: new Set(),
	destinationPlanetId: null,
	isViewActive: false
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

		// Ship selection methods
		toggleShipSelection: (shipId: number) =>
			update((state) => {
				const newSelectedShipIds = new Set(state.selectedShipIds);
				if (newSelectedShipIds.has(shipId)) {
					newSelectedShipIds.delete(shipId);
				} else {
					newSelectedShipIds.add(shipId);
				}
				return {
					...state,
					selectedShipIds: newSelectedShipIds
				};
			}),

		setSelectedShips: (shipIds: number[]) =>
			update((state) => {
				return {
					...state,
					selectedShipIds: new Set(shipIds)
				};
			}),

		clearSelectedShips: () =>
			update((state) => {
				return {
					...state,
					selectedShipIds: new Set()
				};
			}),

		// Clear destination but keep the selected ships and source planet
		clearDestination: () =>
			update((state) => ({
				...state,
				destinationPlanetId: null,
				isSelectingDestination: false
			})),

		// Clear everything when ships are sent or planet changes
		clearSelection: () =>
			update((state) => ({
				...state,
				isSelectingDestination: false,
				sourcePlanetId: null,
				selectedShipIds: new Set(),
				destinationPlanetId: null
			})),

		// View lifecycle methods
		activateView: () =>
			update((state) => ({
				...state,
				isViewActive: true
			})),

		deactivateView: () =>
			update((state) => ({
				...state,
				isViewActive: false,
				isSelectingDestination: false,
				destinationPlanetId: null
			})),

		reset: () => set(initialState)
	};
}

export const fleetCommandStore = createFleetCommandStore();
