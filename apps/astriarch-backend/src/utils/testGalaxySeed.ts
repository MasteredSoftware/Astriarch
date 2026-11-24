/**
 * Test-only galaxy seed.
 *
 * When set (via POST /api/test/galaxy-seed, which only exists when
 * NODE_ENV=test), new games generate their galaxy with a deterministic random
 * generator so performance benchmarks always run on the same map. Gameplay
 * randomness after generation (AI, battles) is unaffected.
 *
 * The getter also checks NODE_ENV so a seed can never leak into a
 * non-test environment.
 */

let galaxySeed: number | null = null;

export function setTestGalaxySeed(seed: number | null): void {
  galaxySeed = seed;
}

export function getTestGalaxySeed(): number | null {
  return process.env.NODE_ENV === "test" ? galaxySeed : null;
}
