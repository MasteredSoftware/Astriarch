/**
 * Test-only backend routes (registered only when the backend runs with NODE_ENV=test).
 */

const BACKEND_PORT = process.env.TEST_BACKEND_PORT ?? '8002';
const BACKEND_HTTP = `http://localhost:${BACKEND_PORT}`;

async function postTestRoute<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(`${BACKEND_HTTP}/api/test/${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(
			`POST /api/test/${path} failed (HTTP ${res.status}): ${text}. ` +
				`The e2e backend must run with NODE_ENV=test on port ${BACKEND_PORT}; ` +
				'if another process holds that port, stop it or pick a free one with TEST_BACKEND_PORT.'
		);
	}
	return (await res.json()) as T;
}

/**
 * Sets (or, with null, clears) the process-wide galaxy seed. It applies to every
 * game started on the backend until cleared, so always clear it after use.
 */
export async function setGalaxySeed(seed: number | null): Promise<void> {
	await postTestRoute('galaxy-seed', { seed });
}

export interface GrantPlanetResult {
	ok: true;
	playerId: string;
	homePlanetId: number;
	grantedPlanetId: number;
	hexDistance: number;
}

export interface GrantPlanetOptions {
	/** Only grant a planet at least this many hexes from home (integer 1-50). */
	minHexDistance?: number;
}

/**
 * Gives the human player of an in-progress `__e2e__` game the unowned planet
 * nearest its home (with `minHexDistance`: the nearest one at least that far),
 * plus one Scout there. Clients see it after a SYNC_STATE. If no planet
 * qualifies, the thrown error includes the route's `detail`.
 */
export async function grantPlanet(
	gameName: string,
	opts: GrantPlanetOptions = {}
): Promise<GrantPlanetResult> {
	return postTestRoute<GrantPlanetResult>('grant-planet', { gameName, ...opts });
}

export interface FleetAttackCounts {
	scouts?: number;
	destroyers?: number;
	cruisers?: number;
	battleships?: number;
}

export interface FleetAttackSetup {
	ok: true;
	playerId: string;
	aiPlayerId: string;
	/** Human home planet H. */
	homePlanetId: number;
	/** AI home planet T, the attack target. */
	targetPlanetId: number;
	/** S = T+2, owned by the human, holding the attack fleet. */
	stagingPlanetId: number;
	/** R = T+1, owned by the AI so capturing T does not end the game. */
	aiSparePlanetId: number;
	/** C = T-2, owned by the human, every citizen protesting. */
	collisionPlanetId: number;
	/** Hex distance from S to T. */
	hexDistance: number;
	fleetStrength: number;
	shipIds: string[];
}

/**
 * Issue #83 scenario: next to the AI home planet T, gives the human T+2 (with a large
 * mixed fleet; default 10/10/15/12 ships, strength 744) and T-2 (citizens protesting),
 * and gives the AI T+1. Clients see it after a SYNC_STATE. Counts are integers 0-200.
 */
export async function setupFleetAttack(
	gameName: string,
	counts: FleetAttackCounts = {}
): Promise<FleetAttackSetup> {
	return postTestRoute<FleetAttackSetup>('setup-fleet-attack', { gameName, ...counts });
}
