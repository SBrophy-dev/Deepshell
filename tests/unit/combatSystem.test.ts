import { describe, it, expect } from 'vitest';
import { resolveMeleeAttack, resolveRangedAttack } from '../../src/systems/combatSystem.js';
import { createRNG } from '../../src/utils/rng.js';
import type {
  Entity,
  Player,
  Enemy,
  GameState,
  Floor,
  Tile,
  Direction,
} from '../../src/models/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTile(walkable = true): Tile {
  return {
    type: 'floor',
    char: '.',
    walkable,
    entity: null,
    item: null,
  };
}

function makeWall(): Tile {
  return {
    type: 'wall',
    char: '#',
    walkable: false,
    entity: null,
    item: null,
  };
}

function makeGrid(width: number, height: number): Tile[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => makeTile()),
  );
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy-1',
    name: 'Goblin',
    position: { x: 3, y: 3 },
    health: 10,
    maxHealth: 10,
    damage: 3,
    defense: 1,
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

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player',
    name: 'Hero',
    position: { x: 1, y: 1 },
    health: 50,
    maxHealth: 50,
    damage: 5,
    defense: 2,
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
    ...overrides,
  };
}

function makeFloor(enemies: Enemy[] = [], grid?: Tile[][]): Floor {
  return {
    width: 10,
    height: 10,
    grid: grid ?? makeGrid(10, 10),
    rooms: [],
    entry: { x: 0, y: 0 },
    exit: { x: 9, y: 9 },
    enemies,
    items: [],
    isBossFloor: false,
  };
}

function makeState(player: Player, enemies: Enemy[] = [], grid?: Tile[][]): GameState {
  return {
    seed: 'test-seed',
    rng: createRNG('test-seed'),
    player,
    currentFloor: makeFloor(enemies, grid),
    floorNumber: 1,
    messageLog: [],
    gamePhase: 'playing',
    runStats: {
      floorsCleared: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      highestSkillLevels: {
        melee: 1,
        ranged: 1,
        defense: 1,
        stealth: 1,
        perception: 1,
      },
    },
  };
}

// ─── resolveMeleeAttack ─────────────────────────────────────────────────────

describe('resolveMeleeAttack', () => {
  it('calculates damage as attacker.damage - defender.defense (min 1)', () => {
    const player = makePlayer({ damage: 5 });
    const enemy = makeEnemy({ defense: 2, health: 20 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    // base = 5 - 2 = 3, with melee bonus (level 1 * 0.05 = 0.05) → floor(3 * 1.05) = 3
    expect(result.damage).toBe(3);
    expect(result.defenderDefeated).toBe(false);
  });

  it('enforces minimum 1 damage when defense exceeds attack', () => {
    const player = makePlayer({ damage: 1 });
    const enemy = makeEnemy({ defense: 10, health: 20 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  it('applies melee skill bonus as multiplier for player attacker', () => {
    const player = makePlayer({
      damage: 10,
      skills: {
        melee: { level: 10, xp: 0 },  // 10 * 0.05 = 0.50 bonus
        ranged: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        stealth: { level: 1, xp: 0 },
        perception: { level: 1, xp: 0 },
      },
    });
    const enemy = makeEnemy({ defense: 0, health: 50 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    // base = 10 - 0 = 10, bonus = 0.50, damage = floor(10 * 1.50) = 15
    expect(result.damage).toBe(15);
  });

  it('does not apply skill bonus when attacker is not the player', () => {
    const enemy1 = makeEnemy({ id: 'e1', damage: 5, position: { x: 2, y: 2 } });
    const player = makePlayer({ defense: 1 });
    const state = makeState(player, [enemy1]);

    const result = resolveMeleeAttack(enemy1, player, state);

    // base = 5 - 1 = 4, no skill bonus
    expect(result.damage).toBe(4);
  });

  it('awards XP on enemy defeat', () => {
    const player = makePlayer({ damage: 20 });
    const enemy = makeEnemy({ defense: 0, health: 5 });
    const state = makeState(player, [enemy]);
    (state as GameState).floorNumber = 3;

    const result = resolveMeleeAttack(player, enemy, state);

    expect(result.defenderDefeated).toBe(true);
    // XP = 10 + 3 * 5 = 25
    expect(result.xpAwarded).toBe(25);
  });

  it('awards melee skill XP when player attacks', () => {
    const player = makePlayer({ damage: 5 });
    const enemy = makeEnemy({ defense: 0, health: 50 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    expect(result.skillXp).toEqual(
      expect.arrayContaining([{ skill: 'melee', amount: 15 }]),
    );
  });

  it('does not award skill XP when enemy attacks', () => {
    const enemy = makeEnemy({ damage: 5 });
    const player = makePlayer({ defense: 0, health: 50 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(enemy, player, state);

    expect(result.skillXp).toEqual([]);
  });

  it('rolls loot drop on enemy defeat', () => {
    const player = makePlayer({ damage: 100 });
    const enemy = makeEnemy({ defense: 0, health: 1, dropRate: 1.0 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    expect(result.defenderDefeated).toBe(true);
    expect(result.lootDropped).not.toBeNull();
  });

  it('returns null loot when drop rate is 0', () => {
    const player = makePlayer({ damage: 100 });
    const enemy = makeEnemy({ defense: 0, health: 1, dropRate: 0 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    expect(result.defenderDefeated).toBe(true);
    expect(result.lootDropped).toBeNull();
  });

  it('includes defeat message when defender is defeated', () => {
    const player = makePlayer({ damage: 100 });
    const enemy = makeEnemy({ defense: 0, health: 1 });
    const state = makeState(player, [enemy]);

    const result = resolveMeleeAttack(player, enemy, state);

    expect(result.messages.some((m) => m.includes('defeated'))).toBe(true);
  });
});

// ─── resolveRangedAttack ────────────────────────────────────────────────────

describe('resolveRangedAttack', () => {
  it('returns no-target result when no enemy in path', () => {
    const player = makePlayer({
      position: { x: 1, y: 1 },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 5,
      },
    });
    const state = makeState(player, []);

    const result = resolveRangedAttack(player, 'east', state);

    expect(result.damage).toBe(0);
    expect(result.messages).toContain('No target in range.');
  });

  it('hits the first enemy in the projectile path', () => {
    const player = makePlayer({
      damage: 5,
      position: { x: 0, y: 0 },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 8,
      },
    });
    const nearEnemy = makeEnemy({ id: 'e1', name: 'Near Goblin', position: { x: 3, y: 0 }, health: 20, defense: 0 });
    const farEnemy = makeEnemy({ id: 'e2', name: 'Far Goblin', position: { x: 6, y: 0 }, health: 20, defense: 0 });
    const state = makeState(player, [nearEnemy, farEnemy]);

    const result = resolveRangedAttack(player, 'east', state);

    expect(result.damage).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('Near Goblin');
  });

  it('stops at walls', () => {
    const grid = makeGrid(10, 10);
    grid[0][2] = makeWall(); // wall at (2,0)

    const player = makePlayer({
      position: { x: 0, y: 0 },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 8,
      },
    });
    const enemy = makeEnemy({ position: { x: 5, y: 0 }, health: 20 });
    const state = makeState(player, [enemy], grid);

    const result = resolveRangedAttack(player, 'east', state);

    // Wall at x=2 blocks the projectile, enemy at x=5 is not hit
    expect(result.damage).toBe(0);
  });

  it('awards ranged skill XP on hit', () => {
    const player = makePlayer({
      damage: 5,
      position: { x: 0, y: 0 },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 5,
      },
    });
    const enemy = makeEnemy({ position: { x: 2, y: 0 }, health: 50, defense: 0 });
    const state = makeState(player, [enemy]);

    const result = resolveRangedAttack(player, 'east', state);

    expect(result.skillXp).toEqual(
      expect.arrayContaining([{ skill: 'ranged', amount: 15 }]),
    );
  });

  it('awards XP and rolls loot on enemy defeat via ranged', () => {
    const player = makePlayer({
      damage: 100,
      position: { x: 0, y: 0 },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 5,
      },
    });
    const enemy = makeEnemy({ position: { x: 2, y: 0 }, health: 1, defense: 0, dropRate: 1.0 });
    const state = makeState(player, [enemy]);
    state.floorNumber = 2;

    const result = resolveRangedAttack(player, 'east', state);

    expect(result.defenderDefeated).toBe(true);
    expect(result.xpAwarded).toBe(20); // 10 + 2*5
    expect(result.lootDropped).not.toBeNull();
  });

  it('respects weapon range limit', () => {
    const player = makePlayer({
      position: { x: 0, y: 0 },
      equippedWeapon: {
        id: 'bow',
        name: 'Short Bow',
        description: 'A short bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 2,
      },
    });
    const enemy = makeEnemy({ position: { x: 5, y: 0 }, health: 20 });
    const state = makeState(player, [enemy]);

    const result = resolveRangedAttack(player, 'east', state);

    // Enemy at x=5 is beyond range of 2
    expect(result.damage).toBe(0);
  });

  it('applies ranged skill bonus as multiplier', () => {
    const player = makePlayer({
      damage: 10,
      position: { x: 0, y: 0 },
      skills: {
        melee: { level: 1, xp: 0 },
        ranged: { level: 10, xp: 0 },  // 10 * 0.05 = 0.50 bonus
        defense: { level: 1, xp: 0 },
        stealth: { level: 1, xp: 0 },
        perception: { level: 1, xp: 0 },
      },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 5,
      },
    });
    const enemy = makeEnemy({ position: { x: 2, y: 0 }, health: 50, defense: 0 });
    const state = makeState(player, [enemy]);

    const result = resolveRangedAttack(player, 'east', state);

    // base = 10 - 0 = 10, bonus = 0.50, damage = floor(10 * 1.50) = 15
    expect(result.damage).toBe(15);
  });

  it('works in all four directions', () => {
    const directions: Direction[] = ['north', 'south', 'east', 'west'];
    const offsets = [
      { x: 5, y: 3 },  // north: enemy above
      { x: 5, y: 7 },  // south: enemy below
      { x: 7, y: 5 },  // east: enemy right
      { x: 3, y: 5 },  // west: enemy left
    ];

    for (let i = 0; i < directions.length; i++) {
      const player = makePlayer({
        damage: 10,
        position: { x: 5, y: 5 },
        equippedWeapon: {
          id: 'bow',
          name: 'Bow',
          description: 'A bow',
          category: 'weapon',
          floorLevel: 1,
          damage: 5,
          range: 5,
        },
      });
      const enemy = makeEnemy({ position: offsets[i], health: 50, defense: 0 });
      const state = makeState(player, [enemy]);

      const result = resolveRangedAttack(player, directions[i], state);

      expect(result.damage).toBeGreaterThan(0);
    }
  });

  it('ignores dead enemies (health <= 0)', () => {
    const player = makePlayer({
      damage: 5,
      position: { x: 0, y: 0 },
      equippedWeapon: {
        id: 'bow',
        name: 'Bow',
        description: 'A bow',
        category: 'weapon',
        floorLevel: 1,
        damage: 5,
        range: 5,
      },
    });
    const deadEnemy = makeEnemy({ position: { x: 2, y: 0 }, health: 0 });
    const state = makeState(player, [deadEnemy]);

    const result = resolveRangedAttack(player, 'east', state);

    expect(result.damage).toBe(0);
  });
});
