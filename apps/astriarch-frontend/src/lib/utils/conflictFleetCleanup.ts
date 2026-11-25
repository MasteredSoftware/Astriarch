import {
	ClientEventType,
	type ClientEvent,
	type FleetAttackFailedEvent,
	type PlanetCapturedEvent
} from 'astriarch-engine';

/**
 * Returns the main player's own fleet id named by a conflict event, for clearing its pending arrival.
 *
 * Fleet ids are player-scoped. Only the attacker's own events (PLANET_CAPTURED, FLEET_ATTACK_FAILED)
 * name a fleet the main player owns. PLANET_LOST and FLEET_DEFENSE_SUCCESS go to the defender and carry
 * the attacker's fleet id, which must not be looked up in the defender's fleets.
 */
export function resolvedOwnFleetId(event: ClientEvent): number | undefined {
	switch (event.type) {
		case ClientEventType.PLANET_CAPTURED:
			return (event as PlanetCapturedEvent).data?.attackingFleetId;
		case ClientEventType.FLEET_ATTACK_FAILED:
			return (event as FleetAttackFailedEvent).data?.attackingFleetId;
		default:
			return undefined;
	}
}
