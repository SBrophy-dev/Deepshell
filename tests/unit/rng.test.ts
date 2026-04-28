import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng.js';

describe('SeededRNG', () => {
  it('produces values in [0, 1)', () => {
    const rng = createRNG('test-seed');
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed produces same sequence', () => {
    const a = createRNG('hello');
    const b = createRNG('hello');
    for (let i = 0; i < 50; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = createRNG('seed-a');
    const b = createRNG('seed-b');
    const aVals = Array.from({ length: 10 }, () => a.next());
    const bVals = Array.from({ length: 10 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  describe('nextInt', () => {
    it('returns integers in [min, max] inclusive', () => {
      const rng = createRNG('int-test');
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(3, 7);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
      }
    });

    it('returns min when min === max', () => {
      const rng = createRNG('single');
      expect(rng.nextInt(5, 5)).toBe(5);
    });
  });

  describe('shuffle', () => {
    it('returns an array of the same length with the same elements', () => {
      const rng = createRNG('shuffle-test');
      const arr = [1, 2, 3, 4, 5, 6, 7, 8];
      const shuffled = rng.shuffle(arr);
      expect(shuffled).toHaveLength(arr.length);
      expect(shuffled.sort((a, b) => a - b)).toEqual(arr);
    });

    it('does not mutate the original array', () => {
      const rng = createRNG('no-mutate');
      const arr = [10, 20, 30];
      const copy = [...arr];
      rng.shuffle(arr);
      expect(arr).toEqual(copy);
    });

    it('is deterministic', () => {
      const a = createRNG('det-shuffle');
      const b = createRNG('det-shuffle');
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
    });
  });

  describe('fork', () => {
    it('creates an independent child RNG', () => {
      const parent = createRNG('fork-test');
      const child = parent.fork();
      // Child and parent should produce different sequences
      const parentVals = Array.from({ length: 10 }, () => parent.next());
      const childVals = Array.from({ length: 10 }, () => child.next());
      expect(parentVals).not.toEqual(childVals);
    });

    it('forking is deterministic — same seed produces same child', () => {
      const a = createRNG('fork-det');
      const b = createRNG('fork-det');
      const childA = a.fork();
      const childB = b.fork();
      for (let i = 0; i < 20; i++) {
        expect(childA.next()).toBe(childB.next());
      }
    });

    it('parent sequence continues independently after fork', () => {
      const a = createRNG('fork-parent');
      const b = createRNG('fork-parent');
      a.fork(); // advance a's state
      b.fork(); // advance b's state
      // After forking, both parents should still be in sync
      for (let i = 0; i < 10; i++) {
        expect(a.next()).toBe(b.next());
      }
    });
  });
});
