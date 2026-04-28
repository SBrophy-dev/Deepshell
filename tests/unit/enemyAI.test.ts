import { describe, it, expect } from 'vitest';
import { tick } from '../../src/systems/enemyAI.js';
import { createRNG } from '../../src/utils/rng.js';
import type {
  Enemy,
  GameState,
  Player,
  Floor,
  Tile,
  Position,
} from '../../src/models/index.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeTile(walkable = true): Tile {
  return {
    type: walkable ? 'floor' : 'wall',
    char: walkable ? '.' : '#',
    walkable,
    entity: null,
    item: null,
  };
}

/** Build a simple open grid of the given size. */
function makeGrid(w: number, h: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < w; x++) {
      row.push(makeTile(true));
    }
    grid.push(row);
  }
  return grid;
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'e1',
    name: 'Goblin',
    position: { x: 5, y: 5 },
    health: 10,
    maxHealth: 10,
    damage: 2,
    defense: 0,
    behavior: 'melee',
    detectionRange: 5,
    patrolPath: null,
    isAggro: false,
    isBoss: false,
    specialAttacks: null,
    dropRate: 0.5,
    ...overrides,
  };
}

function makePlayer(pos: Position): Player {
  return {
    id: 'player',
    name: 'Hero',
    position: pos,
    health: 100,
    maxHealth: 100,
    damage: 10,
    defense: 5,
    level: 1,
    xp: 0,
    skills: {
      melee: { level: 1, xp: 0 },
      ranged: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      stealth: { level: 1, xp: 0 },
      perception: { level: 1, xp: 0 },
    },
    inventory: { items: [], maxCapacity: 20 },
    equippedWeapon: null,
    equippedArmor: null,
    lastPerk: null,
  };
}

function makeState(
  grid: Tile[][],
  playerPos: Position,
  seed = 'test-seed',
): GameState {
  const floor: Floor = {
    width: grid[0].length,
    height: grid.length,
    grid,
    rooms: [],
    entry: { x: 0, y: 0 },
    exit: { x: 9, y: 9 },
    enemies: [],
    items: [],
    isBossFloor: false,
  };
  return {
    seed,
    rng: createRNG(seed),
    player: makePlayer(playerPos),
    currentFloor: floor,
    floorNumber: 1,
    messageLog: [],
    gamePhase: 'playing',
    runStats: {
      floorsCleared: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      highestSkillLevels: {
        melee: 1, ranged: 1, defense: 1, stealth: 1, perception: 1,
      },
    },
  };
}


// ─── Melee behavior ──────────────────────────────────────────────────────────

describe('EnemyAI - melee behavior', () => {
  it('attacks when adjacent to player', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 5, y: 4 });
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'melee' });

    const action = tick(enemy, state);

    expect(action.type).toBe('meleeAttack');
    if (action.type === 'meleeAttack') {
      expect(action.target).toEqual({ x: 5, y: 4 });
    }
  });

  it('chases player when within detection range and has LOS', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 5, y: 2 });
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'melee' });

    const action = tick(enemy, state);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Should move closer to the player
      const oldDist = Math.abs(5 - 2); // 3
      const newDist =
        Math.abs(action.position.x - 5) + Math.abs(action.position.y - 2);
      expect(newDist).toBeLessThan(oldDist);
    }
  });

  it('wanders or idles when player is out of detection range', () => {
    const grid = makeGrid(20, 20);
    const state = makeState(grid, { x: 0, y: 0 });
    const enemy = makeEnemy({
      position: { x: 15, y: 15 },
      behavior: 'melee',
      detectionRange: 5,
    });

    const action = tick(enemy, state);

    expect(['move', 'idle']).toContain(action.type);
    if (action.type === 'move') {
      // Should be an adjacent tile
      const dx = Math.abs(action.position.x - 15);
      const dy = Math.abs(action.position.y - 15);
      expect(dx + dy).toBe(1);
    }
  });

  it('wanders or idles when no LOS (wall blocks)', () => {
    const grid = makeGrid(10, 10);
    // Place a wall between enemy and player
    grid[4][5] = makeTile(false);
    grid[4][4] = makeTile(false);
    grid[4][6] = makeTile(false);
    grid[3][5] = makeTile(false);
    grid[3][4] = makeTile(false);
    grid[3][6] = makeTile(false);

    const state = makeState(grid, { x: 5, y: 2 });
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'melee' });

    const action = tick(enemy, state);

    expect(['move', 'idle']).toContain(action.type);
  });
});

// ─── Ranged behavior ─────────────────────────────────────────────────────────

describe('EnemyAI - ranged behavior', () => {
  it('fires when at good distance (2-3 tiles) with LOS', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 5, y: 3 });
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'ranged' });

    const action = tick(enemy, state);

    expect(action.type).toBe('rangedAttack');
    if (action.type === 'rangedAttack') {
      expect(action.direction).toBe('north');
    }
  });

  it('moves away when adjacent to player', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 5, y: 4 });
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'ranged' });

    const action = tick(enemy, state);

    // Should try to retreat
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const newDist =
        Math.abs(action.position.x - 5) + Math.abs(action.position.y - 4);
      expect(newDist).toBeGreaterThan(1);
    }
  });

  it('melee attacks when adjacent and cannot retreat', () => {
    // Surround enemy with walls except the player side
    const grid = makeGrid(10, 10);
    grid[6][5] = makeTile(false); // south
    grid[5][4] = makeTile(false); // west
    grid[5][6] = makeTile(false); // east

    const state = makeState(grid, { x: 5, y: 4 }); // player north
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'ranged' });

    const action = tick(enemy, state);

    expect(action.type).toBe('meleeAttack');
    if (action.type === 'meleeAttack') {
      expect(action.target).toEqual({ x: 5, y: 4 });
    }
  });

  it('approaches when in range but too far (4-5 tiles)', () => {
    const grid = makeGrid(12, 12);
    const state = makeState(grid, { x: 5, y: 1 });
    const enemy = makeEnemy({ position: { x: 5, y: 5 }, behavior: 'ranged' });

    const action = tick(enemy, state);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const oldDist = 4;
      const newDist =
        Math.abs(action.position.x - 5) + Math.abs(action.position.y - 1);
      expect(newDist).toBeLessThan(oldDist);
    }
  });

  it('wanders when out of detection range', () => {
    const grid = makeGrid(20, 20);
    const state = makeState(grid, { x: 0, y: 0 });
    const enemy = makeEnemy({
      position: { x: 15, y: 15 },
      behavior: 'ranged',
      detectionRange: 5,
    });

    const action = tick(enemy, state);

    expect(['move', 'idle']).toContain(action.type);
  });
});

// ─── Patrol behavior ─────────────────────────────────────────────────────────

describe('EnemyAI - patrol behavior', () => {
  it('follows patrol path when not aggro', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 0, y: 0 }); // player far away
    const patrolPath: Position[] = [
      { x: 3, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 6 },
      { x: 3, y: 6 },
    ];
    const enemy = makeEnemy({
      position: { x: 3, y: 3 },
      behavior: 'patrol',
      patrolPath,
      isAggro: false,
    });

    const action = tick(enemy, state);

    expect(action.type).toBe('move');
  });

  it('becomes aggro and chases when player detected', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 5, y: 3 });
    const enemy = makeEnemy({
      position: { x: 5, y: 5 },
      behavior: 'patrol',
      patrolPath: [{ x: 5, y: 5 }, { x: 7, y: 5 }],
      isAggro: false,
    });

    const action = tick(enemy, state);

    expect(enemy.isAggro).toBe(true);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const newDist =
        Math.abs(action.position.x - 5) + Math.abs(action.position.y - 3);
      expect(newDist).toBeLessThan(2); // closer than original dist of 2
    }
  });

  it('attacks when aggro and adjacent', () => {
    const grid = makeGrid(10, 10);
    const state = makeState(grid, { x: 5, y: 4 });
    const enemy = makeEnemy({
      position: { x: 5, y: 5 },
      behavior: 'patrol',
      isAggro: true,
    });

    const action = tick(enemy, state);

    expect(action.type).toBe('meleeAttack');
    if (action.type === 'meleeAttack') {
      expect(action.target).toEqual({ x: 5, y: 4 });
    }
  });

  it('idles when not aggro and no patrol path', () => {
    const grid = makeGrid(20, 20);
    const state = makeState(grid, { x: 0, y: 0 });
    const enemy = makeEnemy({
      position: { x: 15, y: 15 },
      behavior: 'patrol',
      patrolPath: null,
      isAggro: false,
    });

    const action = tick(enemy, state);

    expect(action.type).toBe('idle');
  });
});
