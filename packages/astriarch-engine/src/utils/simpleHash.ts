/**
 * Simple FNV-1a hash implementation for general-purpose hashing.
 * This is synchronous and works in both browser and Node.js environments.
 * Not cryptographically secure, but sufficient for checksums and dedup detection.
 */

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * Generate a simple hash from a string using FNV-1a algorithm.
 * Fast, deterministic, and synchronous.
 *
 * @param str - Input string to hash
 * @returns 8-character hex string representing the hash
 */
export function simpleHash(str: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
