import { describe, it, expect } from 'vitest';
import { findPath, hasLineOfSight } from '../../src/utils/pathfinder.js';
import type { Tile, Position } from '../../src/models/index.js';

// Helper to build a grid from a string map
// '.' = walkable floor, '#' = wall
function makeGrid(map: string[]): Tile[][] {
  return map.map((row) =>
    [...row].map((ch) => ({
      type: ch === '#' ? 'wall' as const : 'floor' as const,
      char: ch,
      walkable: ch !== '#',
      entity: null,
      item: null,
    })),
  );
}

describe('findPath', () => {
  it('finds a straight-line path on an open grid', () => {
    const grid = makeGrid([
      '.....',
      '.....',
      '.....',
    ]);
    const path = findPath(grid, { x: 0, y: 1 }, { x: 4, y: 1 });
    expect(path.length).toBeGreaterThan(0);
    // Last position should be the target
    expect(path[path.length - 1]).toEqual({ x: 4, y: 1 });
    // Start should NOT be in the path
    expect(path.find((p) => p.x === 0 && p.y === 1)).toBeUndefined();
  });

  it('navigates around a wall', () => {
    const grid = makeGrid([
      '...',
      '.#.',
      '...',
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
    // No position in the path should be the wall
    expect(path.find((p) => p.x === 1 && p.y === 1)).toBeUndefined();
  });

  it('returns empty array when no path exists', () => {
    const grid = makeGrid([
      '..#..',
      '..#..',
      '..#..',
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).toEqual([]);
  });

  it('returns empty array when target is a wall', () => {
    const grid = makeGrid([
      '..#..',
      '.....',
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toEqual([]);
  });

  it('returns empty array when from equals to', () => {
    const grid = makeGrid(['...']);
    const path = findPath(grid, { x: 1, y: 0 }, { x: 1, y: 0 });
    expect(path).toEqual([]);
  });

  it('returns empty array for empty grid', () => {
    const path = findPath([], { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(path).toEqual([]);
  });

  it('returns empty array for out-of-bounds positions', () => {
    const grid = makeGrid(['...']);
    expect(findPath(grid, { x: -1, y: 0 }, { x: 2, y: 0 })).toEqual([]);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 5, y: 0 })).toEqual([]);
  });

  it('finds shortest path length on a simple grid', () => {
    const grid = makeGrid([
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 4 });
    // Manhattan distance is 8, path should be exactly 8 steps
    expect(path.length).toBe(8);
  });
});

describe('hasLineOfSight', () => {
  it('returns true on a clear horizontal line', () => {
    const grid = makeGrid(['......']);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
  });

  it('returns true on a clear vertical line', () => {
    const grid = makeGrid(['.', '.', '.', '.']);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 0, y: 3 })).toBe(true);
  });

  it('returns false when a wall blocks the line', () => {
    const grid = makeGrid(['..#..']);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });

  it('returns true for adjacent positions', () => {
    const grid = makeGrid(['..']);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });

  it('returns true for same position', () => {
    const grid = makeGrid(['.']);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });

  it('returns false for out-of-bounds positions', () => {
    const grid = makeGrid(['...']);
    expect(hasLineOfSight(grid, { x: -1, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it('returns false for empty grid', () => {
    expect(hasLineOfSight([], { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('handles diagonal line of sight', () => {
    const grid = makeGrid([
      '...',
      '...',
      '...',
    ]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(true);
  });

  it('blocks diagonal line of sight through wall', () => {
    const grid = makeGrid([
      '...',
      '.#.',
      '...',
    ]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
  });
});
