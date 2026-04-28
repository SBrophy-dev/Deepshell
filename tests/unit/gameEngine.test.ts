import { describe, it, expect } from 'vitest';
import { initNewGame, processCommand } from '../../src/systems/gameEngine.js';
import type { GameState, ParsedCommand, Direction, Weapon, Consumable, Enemy } from '../../src/models/index.js';

// ─── Helper ──────────────────────────────────────────────────────────────────

function cmd(action: string, target: string | null = null): ParsedCommand {
  return { action, target, raw: target ? `${action} ${target}` : action };
}

// ─── initNewGame ─────────────────────────────────────────────────────────────

describe('initNewGame', () => {
  it('creates a valid game state with default seed', () => {
    const state = initNewGame();
    expect(state.seed).toBeTruthy();
    expect(state.gamePhase).toBe('playing');
    expect(state.floorNumber).toBe(1);
    expect(state.player.health).toBe(100);
    expect(state.player.maxHealth).toBe(100);
    expect(state.player.damage).toBe(5);
    expect(state.player.defense).toBe(2);
    expect(state.player.level).toBe(1);
    expect(state.player.xp).toBe(0);
  });

  it('creates a player with all skills at level 1 and 0 xp', () => {
    const state = initNewGame('test-seed');
    const skills = state.player.skills;
    for (const skill of ['melee', 'ranged', 'defense', 'stealth', 'perception'] as const) {
      expect(skills[skill].level).toBe(1);
      expect(skills[skill].xp).toBe(0);
    }
  });

  it('equips a starter weapon', () => {
    const state = initNewGame('test-seed');
    expect(state.player.equippedWeapon).not.toBeNull();
    expect(state.player.equippedWeapon!.name).toBe('Rusty Dagger');
    expect(state.player.equippedWeapon!.damage).toBe(3);
    expect(state.player.equippedWeapon!.range).toBe(1);
  });

  it('has starter weapon in inventory', () => {
    const state = initNewGame('test-seed');
    expect(state.player.inventory.items.length).toBe(1);
    expect(state.player.inventory.items[0].name).toBe('Rusty Dagger');
    expect(state.player.inventory.maxCapacity).toBe(20);
  });

  it('places player at floor entry', () => {
    const state = initNewGame('test-seed');
    expect(state.player.position).toEqual(state.currentFloor.entry);
  });

  it('initializes message log with welcome message', () => {
    const state = initNewGame('test-seed');
    expect(state.messageLog.length).toBeGreaterThan(0);
    expect(state.messageLog[0]).toContain('Welcome');
  });

  it('initializes run stats to zero', () => {
    const state = initNewGame('test-seed');
    expect(state.runStats.floorsCleared).toBe(0);
    expect(state.runStats.enemiesDefeated).toBe(0);
    expect(state.runStats.bossesDefeated).toBe(0);
  });

  it('produces deterministic state with same seed', () => {
    const s1 = initNewGame('deterministic');
    const s2 = initNewGame('deterministic');
    expect(s1.currentFloor.width).toBe(s2.currentFloor.width);
    expect(s1.currentFloor.height).toBe(s2.currentFloor.height);
    expect(s1.currentFloor.entry).toEqual(s2.currentFloor.entry);
    expect(s1.currentFloor.exit).toEqual(s2.currentFloor.exit);
  });

  it('has equippedArmor as null and lastPerk as null', () => {
    const state = initNewGame('test-seed');
    expect(state.player.equippedArmor).toBeNull();
    expect(state.player.lastPerk).toBeNull();
  });
});

// ─── processCommand: Movement ────────────────────────────────────────────────

describe('processCommand - movement', () => {
  it('moves player on walkable tile', () => {
    const state = initNewGame('move-test');
    const { position } = state.player;
    const { grid } = state.currentFloor;

    // Find a walkable direction
    const directions: Direction[] = ['north', 'south', 'east', 'west'];
    const deltas: Record<Direction, { x: number; y: number }> = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      east: { x: 1, y: 0 },
      west: { x: -1, y: 0 },
    };

    for (const dir of directions) {
      const d = deltas[dir];
      const tx = position.x + d.x;
      const ty = position.y + d.y;
      if (
        ty >= 0 && ty < grid.length &&
        tx >= 0 && tx < grid[0].length &&
        grid[ty][tx].walkable &&
        grid[ty][tx].type !== 'stairsDown' &&
        !state.currentFloor.enemies.some(
          (e) => e.health > 0 && e.position.x === tx && e.position.y === ty,
        )
      ) {
        const newState = processCommand(state, cmd(dir));
        expect(newState.player.position.x).toBe(tx);
        expect(newState.player.position.y).toBe(ty);
        return;
      }
    }
    // If no walkable direction found, skip (unlikely with generated floors)
  });

  it('blocks movement into walls', () => {
    const state = initNewGame('wall-test');
    const { position } = state.player;
    const { grid } = state.currentFloor;

    const directions: Direction[] = ['north', 'south', 'east', 'west'];
    const deltas: Record<Direction, { x: number; y: number }> = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      east: { x: 1, y: 0 },
      west: { x: -1, y: 0 },
    };

    for (const dir of directions) {
      const d = deltas[dir];
      const tx = position.x + d.x;
      const ty = position.y + d.y;
      if (
        ty >= 0 && ty < grid.length &&
        tx >= 0 && tx < grid[0].length &&
        !grid[ty][tx].walkable
      ) {
        const newState = processCommand(state, cmd(dir));
        expect(newState.player.position).toEqual(position);
        expect(newState.messageLog.some((m) => m.includes('blocked'))).toBe(true);
        return;
      }
    }
  });
});

// ─── processCommand: Inventory ───────────────────────────────────────────────

describe('processCommand - inventory', () => {
  it('lists inventory items', () => {
    const state = initNewGame('inv-test');
    const newState = processCommand(state, cmd('inventory'));
    expect(newState.messageLog.some((m) => m.includes('Rusty Dagger'))).toBe(true);
  });
});

// ─── processCommand: Skills ──────────────────────────────────────────────────

describe('processCommand - skills', () => {
  it('displays all five skills', () => {
    const state = initNewGame('skills-test');
    const newState = processCommand(state, cmd('skills'));
    const log = newState.messageLog.join('\n');
    expect(log).toContain('Melee');
    expect(log).toContain('Ranged');
    expect(log).toContain('Defense');
    expect(log).toContain('Stealth');
    expect(log).toContain('Perception');
  });
});

// ─── processCommand: Help ────────────────────────────────────────────────────

describe('processCommand - help', () => {
  it('lists available commands', () => {
    const state = initNewGame('help-test');
    const newState = processCommand(state, cmd('help'));
    const log = newState.messageLog.join('\n');
    expect(log).toContain('Available commands');
    expect(log).toContain('attack');
    expect(log).toContain('inventory');
  });
});

// ─── processCommand: Quit ────────────────────────────────────────────────────

describe('processCommand - quit', () => {
  it('sets gamePhase to gameOver', () => {
    const state = initNewGame('quit-test');
    const newState = processCommand(state, cmd('quit'));
    expect(newState.gamePhase).toBe('gameOver');
    expect(newState.messageLog.some((m) => m.includes('Thanks for playing'))).toBe(true);
  });
});

// ─── processCommand: Look ────────────────────────────────────────────────────

describe('processCommand - look', () => {
  it('describes surroundings', () => {
    const state = initNewGame('look-test');
    const newState = processCommand(state, cmd('look'));
    expect(newState.messageLog.some((m) => m.includes('look around'))).toBe(true);
  });
});

// ─── processCommand: Pickup with nothing ─────────────────────────────────────

describe('processCommand - pickup', () => {
  it('reports nothing to pick up when no item at position', () => {
    const state = initNewGame('pickup-test');
    const newState = processCommand(state, cmd('pickup'));
    expect(newState.messageLog.some((m) => m.includes('Nothing to pick up'))).toBe(true);
  });
});

// ─── processCommand: Shoot without ranged weapon ─────────────────────────────

describe('processCommand - shoot', () => {
  it('rejects shoot without ranged weapon', () => {
    const state = initNewGame('shoot-test');
    // Starter weapon is melee (range 1)
    const newState = processCommand(state, cmd('shoot', 'north'));
    expect(newState.messageLog.some((m) => m.includes('No ranged weapon'))).toBe(true);
  });
});

// ─── processCommand: Attack with no adjacent enemy ───────────────────────────

describe('processCommand - attack', () => {
  it('reports no enemy nearby when none adjacent', () => {
    const state = initNewGame('attack-test');
    // Player starts at entry, enemies are usually in other rooms
    const newState = processCommand(state, cmd('attack'));
    expect(newState.messageLog.some((m) => m.includes('No enemy nearby'))).toBe(true);
  });
});

// ─── processCommand: Inspect with no target ──────────────────────────────────

describe('processCommand - inspect', () => {
  it('reports target not recognized for unknown target', () => {
    const state = initNewGame('inspect-test');
    const newState = processCommand(state, cmd('inspect', 'nonexistent'));
    expect(newState.messageLog.some((m) => m.includes('Target not recognized'))).toBe(true);
  });
});

// ─── processCommand: Unequip ─────────────────────────────────────────────────

describe('processCommand - unequip', () => {
  it('unequips weapon', () => {
    const state = initNewGame('unequip-test');
    const newState = processCommand(state, cmd('unequip', 'weapon'));
    expect(newState.player.equippedWeapon).toBeNull();
    expect(newState.messageLog.some((m) => m.includes('unequipped'))).toBe(true);
  });

  it('reports nothing equipped for empty armor slot', () => {
    const state = initNewGame('unequip-test');
    const newState = processCommand(state, cmd('unequip', 'armor'));
    expect(newState.messageLog.some((m) => m.includes('Nothing equipped'))).toBe(true);
  });
});

// ─── processCommand: gameOver blocks commands ────────────────────────────────

describe('processCommand - gameOver', () => {
  it('does not process commands when game is over', () => {
    let state = initNewGame('over-test');
    state = { ...state, gamePhase: 'gameOver' };
    const newState = processCommand(state, cmd('north'));
    expect(newState).toEqual(state);
  });
});

// ─── processCommand: Perk selection ──────────────────────────────────────────

describe('processCommand - perk selection', () => {
  it('rejects invalid perk choice', () => {
    let state = initNewGame('perk-test');
    state = { ...state, gamePhase: 'perkSelection', perkChoices: [] };
    const newState = processCommand(state, cmd('5'));
    expect(newState.messageLog.some((m) => m.includes('Enter 1, 2, or 3'))).toBe(true);
  });
});

// ─── Message log cap ─────────────────────────────────────────────────────────

describe('processCommand - message log cap', () => {
  it('caps message log at 50 messages', () => {
    let state = initNewGame('cap-test');
    state = { ...state, messageLog: Array(55).fill('old message') };
    const newState = processCommand(state, cmd('help'));
    expect(newState.messageLog.length).toBeLessThanOrEqual(50);
  });
});
