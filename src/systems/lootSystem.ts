import type { SeededRNG, Item, Weapon, Armor, Consumable, ConsumableEffect, ItemCategory, SkillType } from '../models/index.js';

// ─── Name tables ─────────────────────────────────────────────────────────────

const WEAPON_PREFIXES = ['Rusty', 'Iron', 'Steel', 'Silver', 'Golden', 'Crystal', 'Shadow', 'Flame'];
const WEAPON_BASES = ['Sword', 'Axe', 'Dagger', 'Mace', 'Spear', 'Bow', 'Crossbow', 'Staff'];
const ARMOR_PREFIXES = ['Tattered', 'Leather', 'Chain', 'Iron', 'Steel', 'Mithril', 'Dragon', 'Void'];
const ARMOR_BASES = ['Vest', 'Tunic', 'Mail', 'Plate', 'Shield', 'Helm', 'Gauntlets', 'Boots'];
const CONSUMABLE_NAMES = ['Health Potion', 'Greater Health Potion', 'Elixir of Strength', 'Scroll of Perception', 'Stealth Draught', 'Defense Tonic', 'Ranger Brew'];
const SKILL_TYPES: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];

let itemCounter = 0;

function nextId(): string {
  return `item_${Date.now()}_${++itemCounter}`;
}

// ─── Item generators ─────────────────────────────────────────────────────────

function generateWeapon(rng: SeededRNG, floorLevel: number): Weapon {
  const prefix = WEAPON_PREFIXES[rng.nextInt(0, WEAPON_PREFIXES.length - 1)];
  const base = WEAPON_BASES[rng.nextInt(0, WEAPON_BASES.length - 1)];
  const name = `${prefix} ${base}`;
  const isRanged = ['Bow', 'Crossbow', 'Staff'].includes(base);
  const damage = Math.max(1, floorLevel + rng.nextInt(1, 3));
  const range = isRanged ? rng.nextInt(3, 6) : 1;

  return {
    id: nextId(),
    name,
    description: `A ${prefix.toLowerCase()} ${base.toLowerCase()} found on floor ${floorLevel}.`,
    category: 'weapon',
    floorLevel,
    damage,
    range,
  };
}

function generateArmor(rng: SeededRNG, floorLevel: number): Armor {
  const prefix = ARMOR_PREFIXES[rng.nextInt(0, ARMOR_PREFIXES.length - 1)];
  const base = ARMOR_BASES[rng.nextInt(0, ARMOR_BASES.length - 1)];
  const name = `${prefix} ${base}`;
  const defense = Math.max(1, floorLevel + rng.nextInt(0, 2));

  return {
    id: nextId(),
    name,
    description: `${prefix} ${base.toLowerCase()} offering decent protection.`,
    category: 'armor',
    floorLevel,
    defense,
  };
}

function generateConsumable(rng: SeededRNG, floorLevel: number): Consumable {
  const isHeal = rng.next() < 0.6;
  let effect: ConsumableEffect;
  let name: string;

  if (isHeal) {
    const amount = 10 + floorLevel * 5 + rng.nextInt(0, 10);
    effect = { type: 'heal', amount };
    name = amount > 30 ? 'Greater Health Potion' : 'Health Potion';
  } else {
    const skill = SKILL_TYPES[rng.nextInt(0, SKILL_TYPES.length - 1)];
    const bonus = 1 + Math.floor(floorLevel / 3);
    const duration = 3 + rng.nextInt(0, 3);
    effect = { type: 'skillBoost', skill, duration, bonus };
    const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);
    name = `${skillLabel} Elixir`;
  }

  return {
    id: nextId(),
    name,
    description: `A consumable found on floor ${floorLevel}.`,
    category: 'consumable',
    floorLevel,
    effect,
  };
}

function generateRandomItem(rng: SeededRNG, floorLevel: number): Item {
  const roll = rng.next();
  if (roll < 0.35) {
    return generateWeapon(rng, floorLevel);
  } else if (roll < 0.65) {
    return generateArmor(rng, floorLevel);
  } else {
    return generateConsumable(rng, floorLevel);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate items placed on a floor during generation.
 * Item count and quality scale with floor number.
 */
export function generateFloorItems(rng: SeededRNG, floorNumber: number): Item[] {
  const count = 2 + Math.floor(floorNumber / 2);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    items.push(generateRandomItem(rng, floorNumber));
  }
  return items;
}

/**
 * Roll for an item drop when an enemy is defeated.
 * Returns null if no drop occurs.
 */
export function rollEnemyDrop(rng: SeededRNG, floorNumber: number, dropRate: number): Item | null {
  if (rng.next() >= dropRate) {
    return null;
  }
  return generateRandomItem(rng, floorNumber);
}

/**
 * Generate higher-quality loot from boss treasure chests.
 * Treasure chest items have floorLevel = floorNumber + bonus, exceeding standard floor loot.
 */
export function generateTreasureChestLoot(rng: SeededRNG, floorNumber: number): Item[] {
  const qualityBonus = 3;
  const boostedLevel = floorNumber + qualityBonus;
  const count = 2 + rng.nextInt(1, 2);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    items.push(generateRandomItem(rng, boostedLevel));
  }
  return items;
}
