import { describe, it, expect } from 'vitest';
import { generateFloor, generateBossFloor } from '../../src/systems/dungeonGenerator.js';
import { createRNG } from '../../src/utils/rng.js';
import { ASCII_CHARS } from '../../src/models/index.js';

describe('generateFloor', () => {
  it('should generate a floor with valid dimensions', () => {
    const rng = createRNG('test-seed');
    const floor = generateFloor(rng, 1);

    expect(floor.width).toBeGreaterThan(0);
    expect(floor.height).toBeGreaterThan(0);
    expect(floor.grid.length).toBe(floor.height);
    expect(floor.grid[0].length).toBe(floor.width);
  });

  it('should place entry and exit points', () => {
    const rng = createRNG('test-seed');
    const floor = generateFloor(rng, 1);

    expect(floor.entry).toBeDefined();
    expect(floor.exit).toBeDefined();
    expect(floor.grid[floor.entry.y][floor.entry.x].type).toBe('stairsUp');
    expect(floor.grid[floor.exit.y][floor.exit.x].type).toBe('stairsDown');
  });

  it('should have entry and exit in different positions', () => {
    const rng = createRNG('test-seed');
    const floor = generateFloor(rng, 1);

    expect(floor.entry.x !== floor.exit.x || floor.entry.y !== floor.exit.y).toBe(true);
  });

  it('should have a traversable path from entry to exit', () => {
    const rng = createRNG('connectivity-test');
    const floor = generateFloor(rng, 1);

    // BFS from entry to exit
    const visited = new Set<string>();
    const queue = [floor.entry];
    visited.add(`${floor.entry.x},${floor.entry.y}`);
    let found = false;

    while (queue.length > 0) {
      const pos = queue.shift()!;
      if (pos.x === floor.exit.x && pos.y === floor.exit.y) {
        found = true;
        break;
      }
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < floor.width && ny >= 0 && ny < floor.height && !visited.has(key) && floor.grid[ny][nx].walkable) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    expect(found).toBe(true);
  });

  it('should place at least one enemy', () => {
    const rng = createRNG('enemy-test');
    const floor = generateFloor(rng, 1);
    expect(floor.enemies.length).toBeGreaterThanOrEqual(1);
  });

  it('should use valid ASCII characters for all tiles', () => {
    const rng = createRNG('ascii-test');
    const floor = generateFloor(rng, 3);
    const validChars = new Set<string>(Object.values(ASCII_CHARS));

    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        expect(validChars.has(floor.grid[y][x].char)).toBe(true);
      }
    }
  });

  it('should scale floor size with floor number', () => {
    const rng1 = createRNG('scale-test');
    const rng2 = createRNG('scale-test');
    const floor1 = generateFloor(rng1, 1);
    // Need a fresh RNG for floor 10 since generateFloor consumes RNG state
    const floor10 = generateFloor(rng2, 10);

    expect(floor10.width * floor10.height).toBeGreaterThanOrEqual(floor1.width * floor1.height);
  });

  it('should scale enemy stats with floor number', () => {
    const rng1 = createRNG('stat-scale');
    const rng2 = createRNG('stat-scale');
    const floor1 = generateFloor(rng1, 1);
    const floor10 = generateFloor(rng2, 10);

    const avgHealth1 = floor1.enemies.reduce((s, e) => s + e.health, 0) / floor1.enemies.length;
    const avgHealth10 = floor10.enemies.reduce((s, e) => s + e.health, 0) / floor10.enemies.length;
    expect(avgHealth10).toBeGreaterThan(avgHealth1);
  });

  it('should place items on the floor', () => {
    const rng = createRNG('items-test');
    const floor = generateFloor(rng, 3);
    expect(floor.items.length).toBeGreaterThanOrEqual(1);
  });

  it('should not be a boss floor for regular floors', () => {
    const rng = createRNG('boss-check');
    const floor = generateFloor(rng, 3);
    expect(floor.isBossFloor).toBe(false);
  });

  it('should have at least 2 rooms', () => {
    const rng = createRNG('rooms-test');
    const floor = generateFloor(rng, 1);
    expect(floor.rooms.length).toBeGreaterThanOrEqual(2);
  });
});

describe('generateBossFloor', () => {
  it('should mark floor as boss floor', () => {
    const rng = createRNG('boss-seed');
    const floor = generateBossFloor(rng, 5);
    expect(floor.isBossFloor).toBe(true);
  });

  it('should have exactly one boss enemy', () => {
    const rng = createRNG('boss-seed');
    const floor = generateBossFloor(rng, 5);
    expect(floor.enemies.length).toBe(1);
    expect(floor.enemies[0].isBoss).toBe(true);
  });

  it('should give boss at least one special attack', () => {
    const rng = createRNG('boss-seed');
    const floor = generateBossFloor(rng, 5);
    expect(floor.enemies[0].specialAttacks).not.toBeNull();
    expect(floor.enemies[0].specialAttacks!.length).toBeGreaterThanOrEqual(1);
  });
});
