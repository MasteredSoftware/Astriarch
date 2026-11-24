import { ColorRgbaData } from '../model/player';

/**
 * mulberry32: small, fast, well-distributed 32-bit PRNG. Used only when a seed
 * is active (see Utils.withRandomSeed) so normal games keep using Math.random.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seededRandom: (() => number) | null = null;

export class Utils {
  /**
   * Returns a float in [0, 1). Uses the seeded generator while inside
   * withRandomSeed, otherwise Math.random. All engine game-logic randomness
   * should go through this (not Math.random directly) so it can be seeded.
   */
  public static random(): number {
    return seededRandom ? seededRandom() : Math.random();
  }

  /**
   * Runs fn with all Utils.random-based randomness driven by a deterministic
   * generator seeded with `seed`, then restores the previous generator.
   * Used to generate reproducible galaxies (e.g. for performance benchmarks).
   * fn must be synchronous; the seed does not carry across awaits.
   */
  public static withRandomSeed<T>(seed: number, fn: () => T): T {
    const previous = seededRandom;
    seededRandom = mulberry32(seed);
    try {
      return fn();
    } finally {
      seededRandom = previous;
    }
  }

  public static nextRandom(lowInclusive: number, highExclusive?: number) {
    if (highExclusive === null || typeof highExclusive == 'undefined') {
      highExclusive = lowInclusive;
      lowInclusive = 0;
    }

    if (lowInclusive < 0) {
      highExclusive += Math.abs(lowInclusive);
    } else {
      highExclusive -= lowInclusive;
    }

    const val = Math.floor(Utils.random() * highExclusive) + lowInclusive;
    return val;
  }

  public static nextRandomFloat(lowInclusive: number, highExclusive: number) {
    return Utils.random() * (highExclusive - lowInclusive) + lowInclusive;
  }

  public static decimalToFixed(number: number, maxDecimalPlaces: number) {
    return number
      ? Math.round(number) != number
        ? number.toFixed(maxDecimalPlaces).replace(/0+$/, '')
        : number
      : number;
  }

  public static ColorRgba(r: number, g: number, b: number, a: number): ColorRgbaData {
    return { r, g, b, a };
  }

  public static compareNumbers(a: number, b: number) {
    if (b < a) return 1;
    else if (b > a) return -1;
    else return 0;
  }

  public static generateUniqueId(): string {
    // Generate a unique ID using timestamp + random string
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomPart}`;
  }
}
