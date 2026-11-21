import type { FleetData } from 'astriarch-engine';

export interface KeyedFleets {
	/** One entry per fleet, in iteration order, with a key unique within the call. */
	keyed: Array<[string, FleetData]>;
	/** Each fleet id seen more than once, listed once. */
	duplicateIds: number[];
}

/**
 * Gives every fleet a canvas key. The first fleet with an id keys as `${id}`;
 * the nth repeat of that id keys as `${id}#${n}`. Fleet ids should be unique
 * per player, but they can collide today, and a collision must not hide a fleet.
 */
export function keyFleets(fleets: Iterable<FleetData>): KeyedFleets {
	const keyed: Array<[string, FleetData]> = [];
	const duplicateIds: number[] = [];
	const repeats = new Map<number, number>();

	for (const fleet of fleets) {
		const n = repeats.get(fleet.id);
		if (n === undefined) {
			repeats.set(fleet.id, 0);
			keyed.push([`${fleet.id}`, fleet]);
			continue;
		}
		if (n === 0) duplicateIds.push(fleet.id);
		repeats.set(fleet.id, n + 1);
		keyed.push([`${fleet.id}#${n + 1}`, fleet]);
	}

	return { keyed, duplicateIds };
}
