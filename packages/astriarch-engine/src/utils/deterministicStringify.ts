/**
 * Deterministic JSON Stringify
 *
 * Creates a deterministic JSON string representation by recursively sorting
 * all object keys. This ensures that objects with the same data always produce
 * the same string, regardless of property insertion order.
 *
 * This is critical for checksum calculations where server and client must
 * produce identical strings from identical data structures.
 */

/**
 * Recursively sorts object keys to create a deterministic structure.
 * Arrays are preserved as-is (order matters for arrays).
 *
 * @param obj Any value to normalize
 * @returns Normalized value with sorted object keys
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    // Arrays: recursively sort keys in each element
    return obj.map(sortKeys);
  }

  // Objects: sort keys alphabetically and recursively process values
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }

  return sorted;
}

/**
 * Stringify an object with deterministic property order.
 * All object keys are sorted alphabetically at every nesting level.
 *
 * @param obj Object to stringify
 * @param space Optional spacing for pretty printing (default: no spacing)
 * @returns Deterministic JSON string
 */
export function deterministicStringify(obj: unknown, space?: string | number): string {
  const normalized = sortKeys(obj);
  return JSON.stringify(normalized, null, space);
}
