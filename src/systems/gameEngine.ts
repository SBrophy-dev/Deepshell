import type {
  GameState,
  ParsedCommand,
  Player,
  Weapon,
  Floor,
  Position,
  Direction,
  Enemy,
  Perk,
  SkillType,
  ItemPlacement,
  CombatResult,
  EnemyAction,
} from '../models/index.js';
import { createRNG } from '../utils/rng.js';
import { generateFloor, generateBossFloor } from './dungeonGenerator.js';
import { resolveMeleeAttack, resolveRangedAttack } from './combatSystem.js';
import { tick } from './enemyAI.js';
import { addItem, removeItem, equipItem, unequipItem, useConsumable } from './inventoryManager.js';
import { awardXp, getBonus } from './skillSystem.js';
import { generateChoices, applyPerk } from './perkSystem.js';
import { generateTreasureChestLoot } from './lootSystem.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_MESSAGE_LOG = 50;

const DIRECTION_DELTAS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

const HELP_TEXT = [
  'Available commands:',
  '  north/south/east/west (n/s/e/w) - Move in a direction',
  '  attack - Attack an adjacent enemy',
  '  shoot [direction] - Fire ranged weapon in a direction',
  '  inventory - List your items',
  '  equip [item] - Equip a weapon or armor',
  '  unequip [weapon/armor] - Unequip from a slot',
  '  use [item] - Use a consumable item',
  '  drop [item] - Drop an item on the floor',
  '  pickup - Pick up an item at your position',
  '  look - Describe your surroundings',
  '  inspect [target] - Inspect an enemy or item',
  '  skills - Show your skill levels',
  '  help - Show this help message',
  '  quit - End the game',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMessages(state: GameState, ...msgs: string[]): GameState {
  const messageLog = [...state.messageLog, ...msgs].slice(-MAX_MESSAGE_LOG);
  return { ...state, messageLog };
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function updateHighestSkillLevels(player: Player, runStats: GameState['runStats']): GameState['runStats'] {
  const highestSkillLevels = { ...runStats.highestSkillLevels };
  const skillTypes: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];
  for (const skill of skillTypes) {
    if (player.skills[skill].level > highestSkillLevels[skill]) {
      highestSkillLevels[skill] = player.skills[skill].level;
    }
  }
  return { ...runStats, highestSkillLevels };
}

// ─── initNewGame ─────────────────────────────────────────────────────────────

export function initNewGame(seed?: string): GameState {
  const actualSeed = seed ?? Date.now().toString();
  const rng = createRNG(actualSeed);

  const starterWeapon: Weapon = {
    id: 'starter-weapon',
    name: 'Rusty Dagger',
    description: 'A basic starting weapon.',
    category: 'weapon',
    floorLevel: 0,
    damage: 3,
    range: 1,
  };

  const player: Player = {
    id: 'player',
    name: 'Player',
    position: { x: 0, y: 0 },
    health: 100,
    maxHealth: 100,
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
    inventory: {
      items: [starterWeapon],
      maxCapacity: 20,
    },
    equippedWeapon: starterWeapon,
    equippedArmor: null,
    lastPerk: null,
  };

  const floor = generateFloor(rng, 1);
  player.position = { ...floor.entry };

  return {
    seed: actualSeed,
    rng,
    player,
    currentFloor: floor,
    floorNumber: 1,
    messageLog: ['Welcome to Deepshell! Type "help" for a list of commands.'],
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

// ─── Movement Handler ────────────────────────────────────────────────────────

function handleMovement(state: GameState, direction: Direction): GameState {
  const delta = DIRECTION_DELTAS[direction];
  const target: Position = {
    x: state.player.position.x + delta.x,
    y: state.player.position.y + delta.y,
  };

  const { grid, enemies } = state.currentFloor;
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  // Out of bounds check
  if (target.x < 0 || target.y < 0 || target.x >= width || target.y >= height) {
    return addMessages(state, 'Path is blocked.');
  }

  const tile = grid[target.y][target.x];

  // Wall check
  if (!tile.walkable) {
    return addMessages(state, 'Path is blocked.');
  }

  // Enemy occupation check
  const blockingEnemy = enemies.find(
    (e) => e.health > 0 && e.position.x === target.x && e.position.y === target.y,
  );
  if (blockingEnemy) {
    return addMessages(state, `Tile is occupied by ${blockingEnemy.name}.`);
  }

  // Boss blocks exit check
  if (tile.type === 'stairsDown') {
    const bossAlive = state.currentFloor.isBossFloor &&
      enemies.some((e) => e.isBoss && e.health > 0);
    if (bossAlive) {
      return addMessages(state, 'The boss blocks the exit!');
    }

    // Floor completed — descend
    return handleDescend(state);
  }

  // Normal movement
  const updatedPlayer = { ...state.player, position: target };

  // Award stealth XP for movement
  const { skills: newSkills, leveledUp } = awardXp(updatedPlayer.skills, 'stealth', 5);
  updatedPlayer.skills = newSkills;

  let newState = { ...state, player: updatedPlayer };
  newState = addMessages(newState, `You move ${direction}.`);

  if (leveledUp) {
    newState = addMessages(newState, `Stealth skill leveled up to ${newSkills.stealth.level}!`);
  }

  newState = {
    ...newState,
    runStats: updateHighestSkillLevels(newState.player, newState.runStats),
  };

  return newState;
}

// ─── Descend Handler ─────────────────────────────────────────────────────────

function handleDescend(state: GameState): GameState {
  const newFloorNumber = state.floorNumber + 1;
  const isBossFloor = newFloorNumber % 5 === 0;
  const newFloor = isBossFloor
    ? generateBossFloor(state.rng, newFloorNumber)
    : generateFloor(state.rng, newFloorNumber);

  const updatedPlayer = { ...state.player, position: { ...newFloor.entry } };

  // Generate perk choices
  const perks = generateChoices(state.rng, state.player.lastPerk);

  const perkMessages = [
    `Floor ${state.floorNumber} completed!`,
    'Choose a perk:',
    ...perks.map((p, i) => `  ${i + 1}. ${p.name} — ${p.description}`),
  ];

  let newState: GameState = {
    ...state,
    player: updatedPlayer,
    currentFloor: newFloor,
    floorNumber: newFloorNumber,
    gamePhase: 'perkSelection',
    perkChoices: perks,
    runStats: {
      ...state.runStats,
      floorsCleared: state.runStats.floorsCleared + 1,
    },
  };

  newState = addMessages(newState, ...perkMessages);
  return newState;
}

// ─── Attack Handler ──────────────────────────────────────────────────────────

function handleAttack(state: GameState): GameState {
  const { player, currentFloor } = state;
  const adjacentEnemy = currentFloor.enemies.find(
    (e) => e.health > 0 && manhattan(player.position, e.position) === 1,
  );

  if (!adjacentEnemy) {
    return addMessages(state, 'No enemy nearby.');
  }

  const result = resolveMeleeAttack(player, adjacentEnemy, state);
  return applyCombatResult(state, result, adjacentEnemy);
}

// ─── Shoot Handler ───────────────────────────────────────────────────────────

function handleShoot(state: GameState, directionStr: string | null): GameState {
  if (!state.player.equippedWeapon || state.player.equippedWeapon.range <= 1) {
    return addMessages(state, 'No ranged weapon equipped.');
  }

  if (!directionStr) {
    return addMessages(state, 'Specify a direction: north, south, east, west.');
  }

  const dir = directionStr.toLowerCase() as Direction;
  if (!['north', 'south', 'east', 'west'].includes(dir)) {
    return addMessages(state, 'Specify a direction: north, south, east, west.');
  }

  const result = resolveRangedAttack(state.player, dir, state);

  // Find the enemy that was hit (if any)
  if (result.damage > 0) {
    // Find the enemy that matches the combat result
    const delta = DIRECTION_DELTAS[dir];
    const grid = state.currentFloor.grid;
    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;
    const range = state.player.equippedWeapon.range;
    let cx = state.player.position.x;
    let cy = state.player.position.y;

    for (let step = 0; step < range; step++) {
      cx += delta.x;
      cy += delta.y;
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) break;
      if (!grid[cy][cx].walkable) break;

      const enemy = state.currentFloor.enemies.find(
        (e) => e.position.x === cx && e.position.y === cy && e.health > 0,
      );
      if (enemy) {
        return applyCombatResult(state, result, enemy);
      }
    }
  }

  // No target hit
  return addMessages(state, ...result.messages);
}

// ─── Combat Result Application ───────────────────────────────────────────────

function applyCombatResult(state: GameState, result: CombatResult, enemy: Enemy): GameState {
  let newState = addMessages(state, ...result.messages);

  // Apply damage to enemy
  const updatedEnemies = newState.currentFloor.enemies.map((e) => {
    if (e.id === enemy.id) {
      return { ...e, health: Math.max(0, e.health - result.damage) };
    }
    return e;
  });

  let updatedFloor = { ...newState.currentFloor, enemies: updatedEnemies };

  // Apply skill XP to player
  let updatedPlayer = { ...newState.player };
  for (const { skill, amount } of result.skillXp) {
    const { skills: newSkills, leveledUp } = awardXp(updatedPlayer.skills, skill, amount);
    updatedPlayer = { ...updatedPlayer, skills: newSkills };
    if (leveledUp) {
      newState = addMessages(newState, `${skill} skill leveled up to ${newSkills[skill].level}!`);
    }
  }

  // Award XP
  if (result.xpAwarded > 0) {
    updatedPlayer = { ...updatedPlayer, xp: updatedPlayer.xp + result.xpAwarded };
  }

  // Handle loot drop
  if (result.lootDropped) {
    const lootPlacement: ItemPlacement = {
      item: result.lootDropped,
      position: { ...enemy.position },
    };
    updatedFloor = {
      ...updatedFloor,
      items: [...updatedFloor.items, lootPlacement],
    };
  }

  // Handle boss defeat — spawn treasure chest loot
  if (result.defenderDefeated && enemy.isBoss) {
    const treasureLoot = generateTreasureChestLoot(state.rng, state.floorNumber);
    const treasurePlacements: ItemPlacement[] = treasureLoot.map((item) => ({
      item,
      position: { ...enemy.position },
    }));
    updatedFloor = {
      ...updatedFloor,
      items: [...updatedFloor.items, ...treasurePlacements],
    };
    newState = addMessages(newState, 'A treasure chest appears!');
  }

  // Update run stats
  let updatedRunStats = { ...newState.runStats };
  if (result.defenderDefeated) {
    updatedRunStats = {
      ...updatedRunStats,
      enemiesDefeated: updatedRunStats.enemiesDefeated + 1,
    };
    if (enemy.isBoss) {
      updatedRunStats = {
        ...updatedRunStats,
        bossesDefeated: updatedRunStats.bossesDefeated + 1,
      };
    }
  }

  updatedRunStats = updateHighestSkillLevels(updatedPlayer, updatedRunStats);

  newState = {
    ...newState,
    player: updatedPlayer,
    currentFloor: updatedFloor,
    runStats: updatedRunStats,
  };

  // Check player death
  if (updatedPlayer.health <= 0) {
    newState = {
      ...newState,
      gamePhase: 'gameOver',
    };
    newState = addMessages(newState, 'You have been defeated...');
  }

  return newState;
}

// ─── Inventory Handler ───────────────────────────────────────────────────────

function handleInventory(state: GameState): GameState {
  const { items } = state.player.inventory;
  if (items.length === 0) {
    return addMessages(state, 'Inventory is empty.');
  }
  const lines = items.map((item) => `  ${item.name} (${item.category})`);
  return addMessages(state, 'Inventory:', ...lines);
}

// ─── Equip Handler ───────────────────────────────────────────────────────────

function handleEquip(state: GameState, target: string | null): GameState {
  if (!target) {
    return addMessages(state, 'Specify an item to equip.');
  }

  const lowerTarget = target.toLowerCase();
  const item = state.player.inventory.items.find(
    (i) => i.name.toLowerCase().includes(lowerTarget),
  );

  if (!item) {
    return addMessages(state, 'Item not found in inventory.');
  }

  const result = equipItem(state.player, item.id);
  if ('error' in result) {
    return addMessages(state, result.error);
  }

  return addMessages(
    { ...state, player: result },
    `${item.name} equipped.`,
  );
}

// ─── Unequip Handler ─────────────────────────────────────────────────────────

function handleUnequip(state: GameState, target: string | null): GameState {
  if (!target) {
    return addMessages(state, 'Specify weapon or armor to unequip.');
  }

  const slot = target.toLowerCase();
  if (slot !== 'weapon' && slot !== 'armor') {
    return addMessages(state, 'Specify weapon or armor to unequip.');
  }

  if (slot === 'weapon' && !state.player.equippedWeapon) {
    return addMessages(state, 'Nothing equipped in that slot.');
  }
  if (slot === 'armor' && !state.player.equippedArmor) {
    return addMessages(state, 'Nothing equipped in that slot.');
  }

  const itemName = slot === 'weapon'
    ? state.player.equippedWeapon!.name
    : state.player.equippedArmor!.name;

  const updatedPlayer = unequipItem(state.player, slot);
  return addMessages(
    { ...state, player: updatedPlayer },
    `${itemName} unequipped.`,
  );
}

// ─── Use Handler ─────────────────────────────────────────────────────────────

function handleUse(state: GameState, target: string | null): GameState {
  if (!target) {
    return addMessages(state, 'Specify an item to use.');
  }

  const lowerTarget = target.toLowerCase();
  const item = state.player.inventory.items.find(
    (i) => i.name.toLowerCase().includes(lowerTarget) && i.category === 'consumable',
  );

  if (!item) {
    return addMessages(state, 'No consumable found with that name.');
  }

  const { player: updatedPlayer, messages } = useConsumable(state.player, item.id);
  let newState = { ...state, player: updatedPlayer };
  newState = addMessages(newState, ...messages);
  return newState;
}

// ─── Drop Handler ────────────────────────────────────────────────────────────

function handleDrop(state: GameState, target: string | null): GameState {
  if (!target) {
    return addMessages(state, 'Specify an item to drop.');
  }

  const lowerTarget = target.toLowerCase();
  const item = state.player.inventory.items.find(
    (i) => i.name.toLowerCase().includes(lowerTarget),
  );

  if (!item) {
    return addMessages(state, 'Item not found in inventory.');
  }

  const updatedInventory = removeItem(state.player.inventory, item.id);
  const updatedPlayer = { ...state.player, inventory: updatedInventory };

  // If dropping equipped weapon or armor, unequip first
  if (state.player.equippedWeapon?.id === item.id) {
    updatedPlayer.equippedWeapon = null;
  }
  if (state.player.equippedArmor?.id === item.id) {
    updatedPlayer.equippedArmor = null;
  }

  const placement: ItemPlacement = {
    item,
    position: { ...state.player.position },
  };

  const updatedFloor = {
    ...state.currentFloor,
    items: [...state.currentFloor.items, placement],
  };

  return addMessages(
    { ...state, player: updatedPlayer, currentFloor: updatedFloor },
    `Dropped ${item.name}.`,
  );
}

// ─── Pickup Handler ──────────────────────────────────────────────────────────

function handlePickup(state: GameState): GameState {
  const { position } = state.player;
  const itemIdx = state.currentFloor.items.findIndex(
    (ip) => ip.position.x === position.x && ip.position.y === position.y,
  );

  if (itemIdx === -1) {
    return addMessages(state, 'Nothing to pick up here.');
  }

  const itemPlacement = state.currentFloor.items[itemIdx];
  const result = addItem(state.player.inventory, itemPlacement.item);

  if ('error' in result) {
    return addMessages(state, 'Inventory is full.');
  }

  const updatedPlayer = { ...state.player, inventory: result };
  const updatedItems = [
    ...state.currentFloor.items.slice(0, itemIdx),
    ...state.currentFloor.items.slice(itemIdx + 1),
  ];
  const updatedFloor = { ...state.currentFloor, items: updatedItems };

  return addMessages(
    { ...state, player: updatedPlayer, currentFloor: updatedFloor },
    `Picked up ${itemPlacement.item.name}.`,
  );
}

// ─── Look Handler ────────────────────────────────────────────────────────────

function handleLook(state: GameState): GameState {
  const { position } = state.player;
  const { grid, enemies, items } = state.currentFloor;
  const messages: string[] = ['You look around...'];

  // Describe adjacent tiles
  const directions: [Direction, string][] = [
    ['north', 'North'],
    ['south', 'South'],
    ['east', 'East'],
    ['west', 'West'],
  ];

  for (const [dir, label] of directions) {
    const delta = DIRECTION_DELTAS[dir];
    const tx = position.x + delta.x;
    const ty = position.y + delta.y;
    if (ty >= 0 && ty < grid.length && tx >= 0 && tx < grid[0].length) {
      const tile = grid[ty][tx];
      const enemy = enemies.find(
        (e) => e.health > 0 && e.position.x === tx && e.position.y === ty,
      );
      if (enemy) {
        messages.push(`  ${label}: ${enemy.name} (${tile.type})`);
      } else {
        messages.push(`  ${label}: ${tile.type}`);
      }
    } else {
      messages.push(`  ${label}: wall`);
    }
  }

  // Items at current position
  const itemsHere = items.filter(
    (ip) => ip.position.x === position.x && ip.position.y === position.y,
  );
  if (itemsHere.length > 0) {
    messages.push('Items here:');
    for (const ip of itemsHere) {
      messages.push(`  ${ip.item.name}`);
    }
  }

  return addMessages(state, ...messages);
}

// ─── Inspect Handler ─────────────────────────────────────────────────────────

function handleInspect(state: GameState, target: string | null): GameState {
  if (!target) {
    return addMessages(state, 'Specify a target to inspect.');
  }

  const lowerTarget = target.toLowerCase();

  // Check adjacent enemies
  const adjacentEnemy = state.currentFloor.enemies.find(
    (e) =>
      e.health > 0 &&
      manhattan(state.player.position, e.position) <= 1 &&
      e.name.toLowerCase().includes(lowerTarget),
  );

  if (adjacentEnemy) {
    const msgs = [
      `${adjacentEnemy.name}:`,
      `  Health: ${adjacentEnemy.health}/${adjacentEnemy.maxHealth}`,
      `  Damage: ${adjacentEnemy.damage}`,
      `  Behavior: ${adjacentEnemy.behavior}`,
    ];
    if (adjacentEnemy.isBoss && adjacentEnemy.specialAttacks) {
      msgs.push(`  Special attacks: ${adjacentEnemy.specialAttacks.map((a) => a.name).join(', ')}`);
    }
    return addMessages(state, ...msgs);
  }

  // Check inventory items
  const invItem = state.player.inventory.items.find(
    (i) => i.name.toLowerCase().includes(lowerTarget),
  );

  if (invItem) {
    const msgs = [
      `${invItem.name}:`,
      `  ${invItem.description}`,
      `  Category: ${invItem.category}`,
    ];
    if (invItem.category === 'weapon') {
      const w = invItem as Weapon;
      msgs.push(`  Damage: ${w.damage}, Range: ${w.range}`);
    }
    return addMessages(state, ...msgs);
  }

  return addMessages(state, 'Target not recognized.');
}

// ─── Skills Handler ──────────────────────────────────────────────────────────

function handleSkills(state: GameState): GameState {
  const { skills } = state.player;
  const skillTypes: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];
  const lines = skillTypes.map((skill) => {
    const s = skills[skill];
    const bonus = getBonus(skills, skill);
    const label = skill.charAt(0).toUpperCase() + skill.slice(1);
    return `  ${label}: Level ${s.level} (XP: ${s.xp}) — Bonus: ${(bonus * 100).toFixed(0)}%`;
  });
  return addMessages(state, 'Skills:', ...lines);
}

// ─── Help Handler ────────────────────────────────────────────────────────────

function handleHelp(state: GameState): GameState {
  return addMessages(state, ...HELP_TEXT);
}

// ─── Quit Handler ────────────────────────────────────────────────────────────

function handleQuit(state: GameState): GameState {
  let newState: GameState = { ...state, gamePhase: 'gameOver' };
  newState = addMessages(newState, 'Thanks for playing!');
  return newState;
}

// ─── Perk Selection Handler ──────────────────────────────────────────────────

function handlePerkSelection(state: GameState, command: ParsedCommand): GameState {
  const choice = parseInt(command.action, 10);
  if (isNaN(choice) || choice < 1 || choice > 3) {
    return addMessages(state, 'Enter 1, 2, or 3 to select a perk.');
  }

  const perks = state.perkChoices;
  if (!perks || perks.length < choice) {
    return addMessages(state, 'No perk choices available.');
  }

  const selectedPerk = perks[choice - 1];
  const updatedPlayer = applyPerk(state.player, selectedPerk);

  let newState: GameState = {
    ...state,
    player: { ...updatedPlayer, lastPerk: selectedPerk.type },
    gamePhase: 'playing',
    perkChoices: undefined,
  };

  newState = addMessages(newState, `You chose ${selectedPerk.name}!`);
  newState = {
    ...newState,
    runStats: updateHighestSkillLevels(newState.player, newState.runStats),
  };

  return newState;
}

// ─── Enemy Tick ──────────────────────────────────────────────────────────────

function tickEnemies(state: GameState): GameState {
  let newState = { ...state };
  const livingEnemies = newState.currentFloor.enemies.filter((e) => e.health > 0);

  for (const enemy of livingEnemies) {
    const action: EnemyAction = tick(enemy, newState);

    switch (action.type) {
      case 'move': {
        const updatedEnemies = newState.currentFloor.enemies.map((e) => {
          if (e.id === enemy.id) {
            return { ...e, position: action.position, isAggro: enemy.isAggro };
          }
          return e;
        });
        newState = {
          ...newState,
          currentFloor: { ...newState.currentFloor, enemies: updatedEnemies },
        };
        break;
      }

      case 'meleeAttack': {
        const result = resolveMeleeAttack(enemy, newState.player, newState);
        newState = addMessages(newState, ...result.messages);

        // Apply damage to player
        const newHealth = Math.max(0, newState.player.health - result.damage);
        let updatedPlayer = { ...newState.player, health: newHealth };

        // Award defense XP to player
        const { skills: newSkills, leveledUp } = awardXp(updatedPlayer.skills, 'defense', 10);
        updatedPlayer = { ...updatedPlayer, skills: newSkills };

        if (leveledUp) {
          newState = addMessages(newState, `Defense skill leveled up to ${newSkills.defense.level}!`);
        }

        newState = { ...newState, player: updatedPlayer };

        // Sync aggro state
        const syncedEnemies = newState.currentFloor.enemies.map((e) => {
          if (e.id === enemy.id) {
            return { ...e, isAggro: enemy.isAggro };
          }
          return e;
        });
        newState = {
          ...newState,
          currentFloor: { ...newState.currentFloor, enemies: syncedEnemies },
        };

        // Check player death
        if (newHealth <= 0) {
          newState = {
            ...newState,
            gamePhase: 'gameOver',
            runStats: updateHighestSkillLevels(newState.player, newState.runStats),
          };
          newState = addMessages(newState, 'You have been defeated...');
          return newState;
        }
        break;
      }

      case 'rangedAttack': {
        const result = resolveRangedAttack(enemy, action.direction, newState);
        newState = addMessages(newState, ...result.messages);

        if (result.damage > 0) {
          const newHealth = Math.max(0, newState.player.health - result.damage);
          let updatedPlayer = { ...newState.player, health: newHealth };

          const { skills: newSkills, leveledUp } = awardXp(updatedPlayer.skills, 'defense', 10);
          updatedPlayer = { ...updatedPlayer, skills: newSkills };

          if (leveledUp) {
            newState = addMessages(newState, `Defense skill leveled up to ${newSkills.defense.level}!`);
          }

          newState = { ...newState, player: updatedPlayer };

          if (newHealth <= 0) {
            newState = {
              ...newState,
              gamePhase: 'gameOver',
              runStats: updateHighestSkillLevels(newState.player, newState.runStats),
            };
            newState = addMessages(newState, 'You have been defeated...');
            return newState;
          }
        }

        // Sync aggro state
        const syncedEnemies = newState.currentFloor.enemies.map((e) => {
          if (e.id === enemy.id) {
            return { ...e, isAggro: enemy.isAggro };
          }
          return e;
        });
        newState = {
          ...newState,
          currentFloor: { ...newState.currentFloor, enemies: syncedEnemies },
        };
        break;
      }

      case 'idle': {
        // Sync aggro state even on idle
        const syncedEnemies = newState.currentFloor.enemies.map((e) => {
          if (e.id === enemy.id) {
            return { ...e, isAggro: enemy.isAggro };
          }
          return e;
        });
        newState = {
          ...newState,
          currentFloor: { ...newState.currentFloor, enemies: syncedEnemies },
        };
        break;
      }
    }
  }

  return newState;
}

// ─── processCommand ──────────────────────────────────────────────────────────

export function processCommand(state: GameState, command: ParsedCommand): GameState {
  // Handle perk selection phase
  if (state.gamePhase === 'perkSelection') {
    return handlePerkSelection(state, command);
  }

  // Handle game over — no commands accepted
  if (state.gamePhase === 'gameOver') {
    return state;
  }

  // Dispatch player action
  let newState: GameState;

  switch (command.action) {
    case 'north':
    case 'south':
    case 'east':
    case 'west':
      newState = handleMovement(state, command.action as Direction);
      break;

    case 'attack':
      newState = handleAttack(state);
      break;

    case 'shoot':
      newState = handleShoot(state, command.target);
      break;

    case 'inventory':
      newState = handleInventory(state);
      break;

    case 'equip':
      newState = handleEquip(state, command.target);
      break;

    case 'unequip':
      newState = handleUnequip(state, command.target);
      break;

    case 'use':
      newState = handleUse(state, command.target);
      break;

    case 'drop':
      newState = handleDrop(state, command.target);
      break;

    case 'pickup':
      newState = handlePickup(state);
      break;

    case 'look':
      newState = handleLook(state);
      break;

    case 'inspect':
      newState = handleInspect(state, command.target);
      break;

    case 'skills':
      newState = handleSkills(state);
      break;

    case 'help':
      newState = handleHelp(state);
      break;

    case 'quit':
      newState = handleQuit(state);
      break;

    default:
      newState = addMessages(state, `Unknown command: ${command.action}`);
      break;
  }

  // Tick enemies only during playing phase and if still playing after player action
  if (newState.gamePhase === 'playing') {
    newState = tickEnemies(newState);
  }

  // Cap message log
  if (newState.messageLog.length > MAX_MESSAGE_LOG) {
    newState = {
      ...newState,
      messageLog: newState.messageLog.slice(-MAX_MESSAGE_LOG),
    };
  }

  return newState;
}
