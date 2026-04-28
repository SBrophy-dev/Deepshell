import type {
  Entity,
  GameState,
  CombatResult,
  Direction,
  Item,
  SkillType,
  Player,
  Position,
} from '../models/index.js';
import { getBonus } from './skillSystem.js';
import { rollEnemyDrop } from './lootSystem.js';

/**
 * Determine whether an entity is the player (has a `skills` property).
 */
function isPlayer(entity: Entity): entity is Player {
  return 'skills' in entity;
}

/**
 * Resolve a melee attack from attacker against defender.
 *
 * Damage = attacker.damage - defender.defense (minimum 1).
 * If attacker is the player, melee skill bonus is applied as a multiplier.
 * On defeat: award XP (10 + floorNumber * 5), melee skill XP (15), roll loot.
 */
export function resolveMeleeAttack(
  attacker: Entity,
  defender: Entity,
  state: GameState,
): CombatResult {
  let baseDamage = Math.max(1, attacker.damage - defender.defense);

  // Apply melee skill bonus if attacker is the player
  if (isPlayer(attacker)) {
    const meleeBonus = getBonus(attacker.skills, 'melee');
    baseDamage = Math.max(1, Math.floor(baseDamage * (1 + meleeBonus)));
  }

  const messages: string[] = [];
  const skillXp: { skill: SkillType; amount: number }[] = [];
  let xpAwarded = 0;
  let lootDropped: Item | null = null;
  const defenderDefeated = defender.health - baseDamage <= 0;

  messages.push(
    `${attacker.name} hits ${defender.name} for ${baseDamage} damage.`,
  );

  if (isPlayer(attacker)) {
    skillXp.push({ skill: 'melee', amount: 15 });
  }

  if (defenderDefeated) {
    messages.push(`${defender.name} is defeated!`);
    xpAwarded = 10 + state.floorNumber * 5;

    // Roll loot drop — need the enemy's dropRate
    const dropRate =
      'dropRate' in defender ? (defender as { dropRate: number }).dropRate : 0;
    lootDropped = rollEnemyDrop(state.rng, state.floorNumber, dropRate);

    if (lootDropped) {
      messages.push(`${defender.name} dropped ${lootDropped.name}!`);
    }
  }

  return {
    damage: baseDamage,
    defenderDefeated,
    messages,
    xpAwarded,
    skillXp,
    lootDropped,
  };
}

/**
 * Get the directional delta for a given Direction.
 */
function directionDelta(direction: Direction): Position {
  switch (direction) {
    case 'north':
      return { x: 0, y: -1 };
    case 'south':
      return { x: 0, y: 1 };
    case 'east':
      return { x: 1, y: 0 };
    case 'west':
      return { x: -1, y: 0 };
  }
}

/**
 * Resolve a ranged attack from attacker in the given direction.
 *
 * Traces a projectile path from the attacker's position, hitting the first
 * enemy encountered within the weapon's range. If no enemy is found, returns
 * a 0-damage result with a "no target" message.
 */
export function resolveRangedAttack(
  attacker: Entity,
  direction: Direction,
  state: GameState,
): CombatResult {
  const noTargetResult: CombatResult = {
    damage: 0,
    defenderDefeated: false,
    messages: ['No target in range.'],
    xpAwarded: 0,
    skillXp: [],
    lootDropped: null,
  };

  // Determine weapon range
  const weapon = isPlayer(attacker) ? attacker.equippedWeapon : null;
  const range = weapon ? weapon.range : 1;

  const delta = directionDelta(direction);
  const grid = state.currentFloor.grid;
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  let cx = attacker.position.x;
  let cy = attacker.position.y;

  // Trace projectile path
  for (let step = 0; step < range; step++) {
    cx += delta.x;
    cy += delta.y;

    // Out of bounds — stop
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) {
      break;
    }

    // Hit a wall — stop
    if (!grid[cy][cx].walkable) {
      break;
    }

    // Check if any enemy occupies this tile
    const enemy = state.currentFloor.enemies.find(
      (e) => e.position.x === cx && e.position.y === cy && e.health > 0,
    );

    if (enemy) {
      // Calculate damage
      let baseDamage = Math.max(1, attacker.damage - enemy.defense);

      if (isPlayer(attacker)) {
        const rangedBonus = getBonus(attacker.skills, 'ranged');
        baseDamage = Math.max(1, Math.floor(baseDamage * (1 + rangedBonus)));
      }

      const messages: string[] = [];
      const skillXp: { skill: SkillType; amount: number }[] = [];
      let xpAwarded = 0;
      let lootDropped: Item | null = null;
      const defenderDefeated = enemy.health - baseDamage <= 0;

      messages.push(
        `${attacker.name} shoots ${enemy.name} for ${baseDamage} damage.`,
      );

      if (isPlayer(attacker)) {
        skillXp.push({ skill: 'ranged', amount: 15 });
      }

      if (defenderDefeated) {
        messages.push(`${enemy.name} is defeated!`);
        xpAwarded = 10 + state.floorNumber * 5;
        lootDropped = rollEnemyDrop(state.rng, state.floorNumber, enemy.dropRate);

        if (lootDropped) {
          messages.push(`${enemy.name} dropped ${lootDropped.name}!`);
        }
      }

      return {
        damage: baseDamage,
        defenderDefeated,
        messages,
        xpAwarded,
        skillXp,
        lootDropped,
      };
    }
  }

  return noTargetResult;
}
