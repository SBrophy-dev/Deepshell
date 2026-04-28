import type { SeededRNG } from '../models/index.js';

/**
 * Hash a string into a 32-bit unsigned integer using a simple DJB2-style hash.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  // Ensure non-zero seed — mulberry32 degenerates at 0
  return hash === 0 ? 1 : hash >>> 0;
}

/**
 * Mulberry32 — a fast, well-distributed 32-bit PRNG.
 * Returns a function that yields the next float in [0, 1) on each call,
 * mutating the internal state.
 */
function mulberry32(seed: number): { next: () => number; state: () => number } {
  let s = seed >>> 0;
  return {
    next(): number {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state(): number {
      return s >>> 0;
    },
  };
}

function createRNGFromNumericSeed(seed: number): SeededRNG {
  const engine = mulberry32(seed);

  const rng: SeededRNG = {
    next(): number {
      return engine.next();
    },

    nextInt(min: number, max: number): number {
      // Returns an integer in [min, max] (inclusive)
      const range = max - min + 1;
      return min + Math.floor(engine.next() * range);
    },

    shuffle<T>(arr: T[]): T[] {
      // Fisher-Yates shuffle on a copy
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(engine.next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },

    fork(): SeededRNG {
      // Derive a child seed from the current state so the parent
      // sequence advances and the child is independent.
      const childSeed = (engine.next() * 4294967296) >>> 0;
      return createRNGFromNumericSeed(childSeed);
    },
  };

  return rng;
}

/**
 * Create a deterministic SeededRNG from a string seed.
 * Two calls with the same seed will always produce the same sequence.
 */
export function createRNG(seed: string): SeededRNG {
  return createRNGFromNumericSeed(hashString(seed));
}
