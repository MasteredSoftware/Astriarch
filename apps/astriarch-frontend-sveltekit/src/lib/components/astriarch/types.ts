import type { Snippet } from 'svelte';

export type Size = 'lg' | 'md' | 'sm' | 'xs';

export type IconImageType =
	| 'population'
	| 'food'
	| 'energy'
	| 'research'
	| 'ore'
	| 'iridium'
	| 'exit'
	| 'volume'
	| 'ship_attack'
	| 'ship_defense'
	| 'ship_speed'
	| 'farm'
	| 'mine'
	| 'colony'
	| 'factory'
	| 'space_platform'
	| 'defender'
	| 'scout'
	| 'destroyer'
	| 'cruiser'
	| 'battleship';

export interface TabControllerTab {
	label: string;
	children?: Snippet;
	onclick?: () => void;
}

export interface PlanetResourceData {
	food: number;
	energy: number;
	research: number;
	ore: number;
	iridium: number;
	production: number;
}

export interface ResourceData {
	total: PlanetResourceData;
	perTurn: PlanetResourceData;
}
