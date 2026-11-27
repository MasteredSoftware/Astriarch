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
