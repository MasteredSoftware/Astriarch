import { describe, it, expect } from 'vitest';
import {
	ClientEventType,
	type ClientEvent,
	type FleetAttackFailedEvent,
	type FleetDefenseSuccessEvent,
	type FleetLaunchedEvent,
	type PlanetCapturedEvent,
	type PlanetLostEvent
} from 'astriarch-engine';
import { resolvedOwnFleetId } from './conflictFleetCleanup';

function event(type: ClientEventType, attackingFleetId?: number): ClientEvent {
	return { type, affectedPlayerIds: ['me'], data: { planetId: 1, attackingFleetId } };
}

describe('resolvedOwnFleetId', () => {
	it('returns the attacking fleet id for PLANET_CAPTURED', () => {
		const e = event(ClientEventType.PLANET_CAPTURED, 4) as PlanetCapturedEvent;
		expect(resolvedOwnFleetId(e)).toBe(4);
	});

	it('returns the attacking fleet id for FLEET_ATTACK_FAILED', () => {
		const e = event(ClientEventType.FLEET_ATTACK_FAILED, 7) as FleetAttackFailedEvent;
		expect(resolvedOwnFleetId(e)).toBe(7);
	});

	it("returns undefined for PLANET_LOST even when the attacker's fleet id is set", () => {
		const e = event(ClientEventType.PLANET_LOST, 3) as PlanetLostEvent;
		expect(resolvedOwnFleetId(e)).toBeUndefined();
	});

	it("returns undefined for FLEET_DEFENSE_SUCCESS even when the attacker's fleet id is set", () => {
		const e = event(ClientEventType.FLEET_DEFENSE_SUCCESS, 3) as FleetDefenseSuccessEvent;
		expect(resolvedOwnFleetId(e)).toBeUndefined();
	});

	it('returns undefined when the attacking fleet id is missing', () => {
		expect(resolvedOwnFleetId(event(ClientEventType.PLANET_CAPTURED))).toBeUndefined();
		expect(resolvedOwnFleetId(event(ClientEventType.FLEET_ATTACK_FAILED))).toBeUndefined();
	});

	it('returns undefined for an unrelated event', () => {
		const e = event(ClientEventType.FLEET_LAUNCHED, 2) as FleetLaunchedEvent;
		expect(resolvedOwnFleetId(e)).toBeUndefined();
	});
});
