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
	| 'volume';

export interface TabControllerTab {
	label: string;
	children?: Snippet;
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
