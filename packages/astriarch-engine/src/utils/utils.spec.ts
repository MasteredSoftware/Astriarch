import { describe, it, expect, vi, afterEach } from 'vitest';
import { Utils } from './utils';
import { startNewTestGame } from '../test/testUtils';

// Planet ids come from a process-wide counter, so they are not part of the
// seeded layout; everything that determines what is drawn is.
const planetLayout = () =>
  startNewTestGame().gameModel.modelData.planets.map((p) => ({
    name: p.name,
    type: p.type,
    x: p.boundingHexMidPoint.x,
    y: p.boundingHexMidPoint.y,
  }));

describe('Utils seeded randomness', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces the same sequence for the same seed', () => {
    const a = Utils.withRandomSeed(42, () => [Utils.random(), Utils.nextRandom(100), Utils.nextRandomFloat(1, 2)]);
    const b = Utils.withRandomSeed(42, () => [Utils.random(), Utils.nextRandom(100), Utils.nextRandomFloat(1, 2)]);
    expect(a).toEqual(b);
  });

  it('produces different sequences for different seeds', () => {
    const a = Utils.withRandomSeed(1, () => [Utils.random(), Utils.random(), Utils.random()]);
    const b = Utils.withRandomSeed(2, () => [Utils.random(), Utils.random(), Utils.random()]);
    expect(a).not.toEqual(b);
  });

  it('keeps values in range', () => {
    Utils.withRandomSeed(7, () => {
      for (let i = 0; i < 1000; i++) {
        const r = Utils.random();
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(1);
        const n = Utils.nextRandom(3, 9);
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThan(9);
      }
    });
  });

  it('uses Math.random outside withRandomSeed, including after it returns or throws', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(Utils.random()).toBe(0.5);

    Utils.withRandomSeed(3, () => Utils.random());
    expect(Utils.random()).toBe(0.5);

    expect(() =>
      Utils.withRandomSeed(3, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(Utils.random()).toBe(0.5);
    expect(spy).toHaveBeenCalled();
  });

  it('generates an identical galaxy for the same seed', () => {
    const first = Utils.withRandomSeed(12345, planetLayout);
    const second = Utils.withRandomSeed(12345, planetLayout);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it('generates a different galaxy for a different seed', () => {
    const first = Utils.withRandomSeed(12345, planetLayout);
    const other = Utils.withRandomSeed(54321, planetLayout);
    expect(other).not.toEqual(first);
  });
});
