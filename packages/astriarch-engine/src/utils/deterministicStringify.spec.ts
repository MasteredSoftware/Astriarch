import { deterministicStringify } from './deterministicStringify';

describe('deterministicStringify', () => {
  test('sorts object keys alphabetically', () => {
    const obj = { z: 1, a: 2, m: 3 };
    const result = deterministicStringify(obj);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  test('handles nested objects with consistent ordering', () => {
    const obj1 = { outer: { z: 1, a: 2 }, name: 'test' };
    const obj2 = { name: 'test', outer: { a: 2, z: 1 } };

    const result1 = deterministicStringify(obj1);
    const result2 = deterministicStringify(obj2);

    // Both should produce identical strings
    expect(result1).toBe(result2);
    expect(result1).toBe('{"name":"test","outer":{"a":2,"z":1}}');
  });

  test('preserves array order', () => {
    const obj = { items: [3, 1, 2], name: 'test' };
    const result = deterministicStringify(obj);
    expect(result).toBe('{"items":[3,1,2],"name":"test"}');
  });

  test('handles deeply nested structures', () => {
    const obj1 = {
      level1: {
        z: 'last',
        a: 'first',
        level2: {
          nested: { z: 1, a: 2 },
          array: [{ z: 1 }, { a: 2 }],
        },
      },
    };

    const obj2 = {
      level1: {
        level2: {
          array: [{ z: 1 }, { a: 2 }],
          nested: { a: 2, z: 1 },
        },
        a: 'first',
        z: 'last',
      },
    };

    const result1 = deterministicStringify(obj1);
    const result2 = deterministicStringify(obj2);

    expect(result1).toBe(result2);
  });

  test('handles null and undefined values', () => {
    const obj = { z: null, a: undefined, m: 'value' };
    const result = deterministicStringify(obj);
    // Note: undefined values are omitted by JSON.stringify
    expect(result).toBe('{"m":"value","z":null}');
  });

  test('handles complex battle event data structure', () => {
    // Simulate the kind of data that was causing checksum mismatches
    const eventData1 = {
      planetId: 30,
      attackerId: 'player_3',
      conflictData: {
        defendingPlayer: {
          id: 'player_0',
          research: {
            '8': { level: 6, points: 568.734677777778 },
            '9': { level: 2, points: 17.177903333333333 },
          },
        },
      },
    };

    // Same data but properties in different order
    const eventData2 = {
      conflictData: {
        defendingPlayer: {
          research: {
            '9': { points: 17.177903333333333, level: 2 },
            '8': { points: 568.734677777778, level: 6 },
          },
          id: 'player_0',
        },
      },
      attackerId: 'player_3',
      planetId: 30,
    };

    const result1 = deterministicStringify(eventData1);
    const result2 = deterministicStringify(eventData2);

    expect(result1).toBe(result2);
  });
});
