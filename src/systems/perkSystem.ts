import type { SeededRNG, Player, Perk, PerkType, PerkEffect, Item, Weapon, SkillType } from '../models/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_PERK_TYPES: PerkType[] = [
  'increasedDamage',
  'increasedHealth',
  'newWeapon',
  'newItem',
  'skillBonus',
];

const BASE_WEIGHT = 10;
const REDUCED_WEIGHT = 2;

const SKILL_TYPES: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];

// ─── Perk Builders ───────────────────────────────────────────────────────────

function buildPerk(rng: SeededRNG, type: PerkType): Perk {
  switch (type) {
    case 'increasedDamage': {
      const amount = 2 + rng.nextInt(0, 3);
      return {
        type,
        name: 'Power Surge',
        description: `Increase your base damage by ${amount}.`,
        effect: { stat: 'damage', amount },
      };
    }
    case 'increasedHealth': {
      const amount = 10 + rng.nextInt(0, 10);
      return {
        type,
        name: 'Vitality Boost',
        description: `Increase your max health by ${amount}.`,
        effect: { stat: 'maxHealth', amount },
      };
    }
    case 'newWeapon': {
      const weapon = generatePerkWeapon(rng);
      return {
        type,
        name: `Found: ${weapon.name}`,
        description: `Receive a ${weapon.name} (damage: ${weapon.damage}, range: ${weapon.range}).`,
        effect: { item: weapon },
      };
    }
    case 'newItem': {
      const item = generatePerkItem(rng);
      return {
        type,
        name: `Found: ${item.name}`,
        description: `Receive a ${item.name}.`,
        effect: { item },
      };
    }
    case 'skillBonus': {
      const skill = SKILL_TYPES[rng.nextInt(0, SKILL_TYPES.length - 1)];
      const label = skill.charAt(0).toUpperCase() + skill.slice(1);
      return {
        type,
        name: `${label} Training`,
        description: `Increase your ${label} skill level by 1.`,
        effect: { skill },
      };
    }
  }
}

// ─── Item Generators for Perks ───────────────────────────────────────────────

const WEAPON_PREFIXES = ['Fine', 'Sharp', 'Sturdy', 'Gleaming', 'Tempered'];
const WEAPON_BASES = ['Sword', 'Axe', 'Dagger', 'Mace', 'Bow', 'Crossbow'];

let perkItemCounter = 0;

function nextPerkId(): string {
  return `perk_item_${Date.now()}_${++perkItemCounter}`;
}

function generatePerkWeapon(rng: SeededRNG): Weapon {
  const prefix = WEAPON_PREFIXES[rng.nextInt(0, WEAPON_PREFIXES.length - 1)];
  const base = WEAPON_BASES[rng.nextInt(0, WEAPON_BASES.length - 1)];
  const isRanged = ['Bow', 'Crossbow'].includes(base);
  const damage = 3 + rng.nextInt(0, 4);
  const range = isRanged ? rng.nextInt(3, 5) : 1;

  return {
    id: nextPerkId(),
    name: `${prefix} ${base}`,
    description: `A ${prefix.toLowerCase()} ${base.toLowerCase()} received as a perk reward.`,
    category: 'weapon',
    floorLevel: 1,
    damage,
    range,
  };
}

function generatePerkItem(rng: SeededRNG): Item {
  const roll = rng.next();
  if (roll < 0.5) {
    // Healing consumable
    const amount = 15 + rng.nextInt(0, 15);
    return {
      id: nextPerkId(),
      name: 'Perk Health Potion',
      description: `Restores ${amount} health.`,
      category: 'consumable',
      floorLevel: 1,
    };
  }
  // Armor piece
  const defense = 2 + rng.nextInt(0, 3);
  return {
    id: nextPerkId(),
    name: 'Perk Shield',
    description: `A sturdy shield with ${defense} defense.`,
    category: 'armor',
    floorLevel: 1,
  };
}

// ─── Weighted Selection ──────────────────────────────────────────────────────

function weightedSelectDistinct(
  rng: SeededRNG,
  types: PerkType[],
  weights: number[],
  count: number,
): PerkType[] {
  const selected: PerkType[] = [];
  const remaining = types.slice();
  const remainingWeights = weights.slice();

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remainingWeights.reduce((sum, w) => sum + w, 0);
    let roll = rng.next() * totalWeight;
    let chosenIdx = 0;

    for (let j = 0; j < remaining.length; j++) {
      roll -= remainingWeights[j];
      if (roll <= 0) {
        chosenIdx = j;
        break;
      }
    }

    selected.push(remaining[chosenIdx]);
    remaining.splice(chosenIdx, 1);
    remainingWeights.splice(chosenIdx, 1);
  }

  return selected;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate exactly 3 weighted random perks for the player to choose from.
 * Reduces the weight of the lastPerk type so it appears less frequently.
 */
export function generateChoices(rng: SeededRNG, lastPerk: PerkType | null): Perk[] {
  const weights = ALL_PERK_TYPES.map((t) => (t === lastPerk ? REDUCED_WEIGHT : BASE_WEIGHT));
  const chosenTypes = weightedSelectDistinct(rng, ALL_PERK_TYPES, weights, 3);
  return chosenTypes.map((type) => buildPerk(rng, type));
}

/**
 * Apply a perk's effect to the player and return the updated player.
 */
export function applyPerk(player: Player, perk: Perk): Player {
  switch (perk.type) {
    case 'increasedDamage':
      return {
        ...player,
        damage: player.damage + (perk.effect.amount ?? 0),
      };

    case 'increasedHealth': {
      const amount = perk.effect.amount ?? 0;
      return {
        ...player,
        maxHealth: player.maxHealth + amount,
        health: player.health + amount,
      };
    }

    case 'newWeapon':
    case 'newItem': {
      if (!perk.effect.item) return player;
      return {
        ...player,
        inventory: {
          ...player.inventory,
          items: [...player.inventory.items, perk.effect.item],
        },
      };
    }

    case 'skillBonus': {
      const skill = perk.effect.skill;
      if (!skill) return player;
      const currentSkill = player.skills[skill];
      return {
        ...player,
        skills: {
          ...player.skills,
          [skill]: {
            ...currentSkill,
            level: currentSkill.level + 1,
          },
        },
      };
    }
  }
}
