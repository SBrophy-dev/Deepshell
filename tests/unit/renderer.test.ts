import { describe, it, expect } from 'vitest';
import {
  render,
  renderTitleScreen,
  renderGameOver,
  renderPerkSelection,
  renderHelp,
  checkTerminalSize,
} from '../../src/ui/renderer.js';
import type {
  GameState,
  Player,
  Floor,
  Tile,
  Enemy,
  ItemPlacement,
  RunStats,
  Perk,
  Weapon,
  Armor,
  SeededRNG,
} from '../../src/models/index.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function makeTile(type: 'wall' | 'floor' | 'corridor' | 'door' | 'stairsUp' | 'stairsDown'): Tile {
  const charMap: Record<string, string> = {
    wall: '#', floor: '.', corridor: '.', door: '+', stairsUp: '<', stairsDown: '>',
  };
  return {
    type,
    char: charMap[type],
    walkable: type !== 'wall',
    entity: null,
    item: null,
  };
}

function makeGrid(width: number, height: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push(makeTile('wall'));
      } else {
        row.push(makeTile('floor'));
      }
    }
    grid.push(row);
  }
  return grid;
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
    dropRate: 0.3,
    ...overrides,
  };
}

const dummyRng: SeededRNG = {
  next: () => 0.5,
  nextInt: (min, max) => min,
  shuffle: <T>(arr: T[]) => [...arr],
  fork: () => dummyRng,
};

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'weapon-1',
    name: 'Iron Sword',
    description: 'A sturdy sword.',
    category: 'weapon',
    floorLevel: 1,
    damage: 5,
    range: 1,
    ...overrides,
  };
}

function makeArmor(overrides: Partial<Armor> = {}): Armor {
  return {
    id: 'armor-1',
    name: 'Leather Vest',
    description: 'Basic armor.',
    category: 'armor',
    floorLevel: 1,
    defense: 3,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player',
    name: 'Player',
    position: { x: 2, y: 2 },
    health: 80,
    maxHealth: 100,
    damage: 5,
    defense: 2,
    level: 3,
    xp: 150,
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

function makeFloor(overrides: Partial<Floor> = {}): Floor {
  return {
    width: 7,
    height: 7,
    grid: makeGrid(7, 7),
    rooms: [{ x: 1, y: 1, width: 5, height: 5 }],
    entry: { x: 1, y: 1 },
    exit: { x: 5, y: 5 },
    enemies: [],
    items: [],
    isBossFloor: false,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 'test-seed',
    rng: dummyRng,
    player: makePlayer(),
    currentFloor: makeFloor(),
    floorNumber: 1,
    messageLog: ['Welcome!'],
    messageScrollOffset: 0,
    gamePhase: 'playing',
    runStats: {
      floorsCleared: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      highestSkillLevels: { melee: 1, ranged: 1, defense: 1, stealth: 1, perception: 1 },
    },
    ...overrides,
  };
}

describe('render', () => {
  it('renders the player @ at the correct position', () => {
    const state = makeGameState();
    const output = render(state);
    expect(stripAnsi(output)).toContain('@');
  });

  it('renders enemies with correct characters', () => {
    const meleeEnemy = makeEnemy({ position: { x: 3, y: 3 }, behavior: 'melee' });
    const rangedEnemy = makeEnemy({ id: 'e2', position: { x: 4, y: 3 }, behavior: 'ranged' });
    const patrolEnemy = makeEnemy({ id: 'e3', position: { x: 5, y: 3 }, behavior: 'patrol' });
    const state = makeGameState({
      currentFloor: makeFloor({ enemies: [meleeEnemy, rangedEnemy, patrolEnemy] }),
    });
    const output = render(state);
    const stripped = stripAnsi(output);
    expect(stripped).toContain('m');
    expect(stripped).toContain('r');
    expect(stripped).toContain('p');
  });

  it('renders boss enemies with B', () => {
    const boss = makeEnemy({ position: { x: 3, y: 3 }, isBoss: true });
    const state = makeGameState({
      currentFloor: makeFloor({ enemies: [boss], isBossFloor: true }),
    });
    const output = render(state);
    expect(stripAnsi(output)).toContain('B');
  });

  it('does not render dead enemies', () => {
    const deadEnemy = makeEnemy({ position: { x: 3, y: 3 }, health: 0 });
    const state = makeGameState({
      currentFloor: makeFloor({ enemies: [deadEnemy] }),
    });
    const output = render(state);
    const lines = stripAnsi(output).split('\n');
    expect(lines[3][3]).toBe('.');
  });

  it('renders items with correct characters', () => {
    const weaponItem: ItemPlacement = {
      item: makeWeapon(),
      position: { x: 3, y: 3 },
    };
    const armorItem: ItemPlacement = {
      item: makeArmor(),
      position: { x: 4, y: 3 },
    };
    const consumableItem: ItemPlacement = {
      item: { id: 'potion', name: 'Potion', description: 'Heals', category: 'consumable', floorLevel: 1 },
      position: { x: 5, y: 3 },
    };
    const state = makeGameState({
      currentFloor: makeFloor({ items: [weaponItem, armorItem, consumableItem] }),
    });
    const output = render(state);
    const stripped = stripAnsi(output);
    expect(stripped).toContain(')');
    expect(stripped).toContain('[');
    expect(stripped).toContain('!');
  });

  it('renders HUD with player stats', () => {
    const weapon = makeWeapon({ name: 'Fire Sword' });
    const armor = makeArmor({ name: 'Steel Plate' });
    const state = makeGameState({
      player: makePlayer({ health: 80, maxHealth: 100, level: 3, xp: 150, equippedWeapon: weapon, equippedArmor: armor }),
      floorNumber: 5,
    });
    const output = render(state);
    expect(stripAnsi(output)).toContain('HP: 80/100');
    expect(stripAnsi(output)).toContain('Lvl: 3');
    expect(stripAnsi(output)).toContain('XP: 150');
    expect(stripAnsi(output)).toContain('Weapon: Fire Sword');
    expect(stripAnsi(output)).toContain('Armor: Steel Plate');
    expect(stripAnsi(output)).toContain('Floor: 5');
  });

  it('shows "none" for unequipped weapon/armor', () => {
    const state = makeGameState();
    const output = render(state);
    expect(stripAnsi(output)).toContain('Weapon: none');
    expect(stripAnsi(output)).toContain('Armor: none');
  });

  it('shows [BOSS FLOOR] indicator when boss is alive', () => {
    const boss = makeEnemy({ isBoss: true, health: 50 });
    const state = makeGameState({
      currentFloor: makeFloor({ enemies: [boss], isBossFloor: true }),
    });
    const output = render(state);
    expect(stripAnsi(output)).toContain('[BOSS FLOOR]');
  });

  it('does not show [BOSS FLOOR] when boss is dead', () => {
    const boss = makeEnemy({ isBoss: true, health: 0 });
    const state = makeGameState({
      currentFloor: makeFloor({ enemies: [boss], isBossFloor: true }),
    });
    const output = render(state);
    expect(stripAnsi(output)).not.toContain('[BOSS FLOOR]');
  });

  it('renders last 10 messages from message log', () => {
    const messages = ['msg01', 'msg02', 'msg03', 'msg04', 'msg05', 'msg06', 'msg07', 'msg08', 'msg09', 'msg10', 'msg11', 'msg12'];
    const state = makeGameState({ messageLog: messages });
    const output = render(state);
    const stripped = stripAnsi(output);
    expect(stripped).not.toContain('msg01');
    expect(stripped).not.toContain('msg02');
    expect(stripped).toContain('msg03');
    expect(stripped).toContain('msg04');
    expect(stripped).toContain('msg05');
    expect(stripped).toContain('msg06');
    expect(stripped).toContain('msg07');
    expect(stripped).toContain('msg08');
    expect(stripped).toContain('msg09');
    expect(stripped).toContain('msg10');
    expect(stripped).toContain('msg11');
    expect(stripped).toContain('msg12');
  });

  it('renders fewer than 10 messages when log is short', () => {
    const state = makeGameState({ messageLog: ['only one'] });
    const output = render(state);
    expect(stripAnsi(output)).toContain('only one');
  });

  it('player overlays enemies and items at same position', () => {
    const enemy = makeEnemy({ position: { x: 2, y: 2 } });
    const state = makeGameState({
      currentFloor: makeFloor({ enemies: [enemy] }),
    });
    const output = render(state);
    expect(stripAnsi(output)).toContain('@');
  });
});

describe('renderTitleScreen', () => {
  it('contains DEEPSHELL title in ASCII art', () => {
    const output = renderTitleScreen();
    expect(stripAnsi(output)).toContain('____/');
    expect(stripAnsi(output)).toContain('|_____|');
  });

  it('contains all menu options', () => {
    const output = renderTitleScreen();
    const stripped = stripAnsi(output);
    expect(stripped).toContain('1. New Game');
    expect(stripped).toContain('2. New Game with Seed');
    expect(stripped).toContain('3. View High Scores');
    expect(stripped).toContain('4. Quit');
  });

  it('shows seed when provided', () => {
    const output = renderTitleScreen('abc123');
    expect(stripAnsi(output)).toContain('Current seed: abc123');
  });

  it('does not show seed line when not provided', () => {
    const output = renderTitleScreen();
    expect(stripAnsi(output)).not.toContain('Current seed');
  });
});

describe('renderGameOver', () => {
  it('contains GAME OVER header', () => {
    const stats: RunStats = {
      floorsCleared: 10,
      enemiesDefeated: 25,
      bossesDefeated: 2,
      highestSkillLevels: { melee: 5, ranged: 3, defense: 4, stealth: 2, perception: 1 },
    };
    const output = renderGameOver(stats, 'seed-xyz');
    expect(stripAnsi(output)).toContain('GAME OVER');
  });

  it('contains all stats', () => {
    const stats: RunStats = {
      floorsCleared: 10,
      enemiesDefeated: 25,
      bossesDefeated: 2,
      highestSkillLevels: { melee: 5, ranged: 3, defense: 4, stealth: 2, perception: 1 },
    };
    const output = renderGameOver(stats, 'seed-xyz');
    const stripped = stripAnsi(output);
    expect(stripped).toContain('Floors Cleared: 10');
    expect(stripped).toContain('Enemies Defeated: 25');
    expect(stripped).toContain('Bosses Defeated: 2');
    expect(stripped).toContain('Melee: 5');
    expect(stripped).toContain('Ranged: 3');
    expect(stripped).toContain('Defense: 4');
    expect(stripped).toContain('Stealth: 2');
    expect(stripped).toContain('Perception: 1');
    expect(stripped).toContain('Seed: seed-xyz');
  });
});

describe('renderPerkSelection', () => {
  it('contains header and numbered perks', () => {
    const perks: Perk[] = [
      { type: 'increasedDamage', name: 'Power Surge', description: 'More damage.', effect: { stat: 'damage', amount: 3 } },
      { type: 'increasedHealth', name: 'Vitality', description: 'More health.', effect: { stat: 'maxHealth', amount: 10 } },
      { type: 'skillBonus', name: 'Training', description: 'Skill up.', effect: { skill: 'melee' } },
    ];
    const output = renderPerkSelection(perks);
    const stripped = stripAnsi(output);
    expect(stripped).toContain('Choose a Perk:');
    expect(stripped).toContain('1. Power Surge');
    expect(stripped).toContain('2. Vitality');
    expect(stripped).toContain('3. Training');
  });
});

describe('renderHelp', () => {
  it('lists all commands', () => {
    const output = renderHelp();
    const stripped = stripAnsi(output);
    expect(stripped).toContain('north/south/east/west');
    expect(stripped).toContain('attack');
    expect(stripped).toContain('shoot');
    expect(stripped).toContain('inventory');
    expect(stripped).toContain('equip');
    expect(stripped).toContain('unequip');
    expect(stripped).toContain('use');
    expect(stripped).toContain('drop');
    expect(stripped).toContain('pickup');
    expect(stripped).toContain('look');
    expect(stripped).toContain('inspect');
    expect(stripped).toContain('skills');
    expect(stripped).toContain('help');
    expect(stripped).toContain('quit');
  });
});

describe('checkTerminalSize', () => {
  it('returns null for adequate size', () => {
    expect(checkTerminalSize(80, 24)).toBeNull();
    expect(checkTerminalSize(120, 40)).toBeNull();
  });

  it('returns warning for too few columns', () => {
    const result = checkTerminalSize(79, 24);
    expect(result).not.toBeNull();
    expect(stripAnsi(result!)).toContain('80x24');
  });

  it('returns warning for too few rows', () => {
    const result = checkTerminalSize(80, 23);
    expect(result).not.toBeNull();
    expect(stripAnsi(result!)).toContain('80x24');
  });

  it('returns warning for both too small', () => {
    const result = checkTerminalSize(40, 10);
    expect(result).not.toBeNull();
    expect(stripAnsi(result!)).toContain('40x10');
  });
});
