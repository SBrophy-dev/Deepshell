import { describe, it, expect } from 'vitest';
import { generateChoices, applyPerk } from '../../src/systems/perkSystem.js';
import { createRNG } from '../../src/utils/rng.js';
import type { Player, Perk, PerkType, PlayerSkills } from '../../src/models/index.js';

const VALID_PERK_TYPES: PerkType[] = [
  'increasedDamage',
  'increasedHealth',
  'newWeapon',
  'newItem',
  'skillBonus',
];

function makeDefaultSkills(): PlayerSkills {
  const base = () => ({ level: 1, xp: 0 });
  return {
    melee: base(),
    ranged: base(),
    defense: base(),
    stealth: base(),
    perception: base(),
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player_1',
    name: 'Hero',
    position: { x: 1, y: 1 },
    health: 50,
    maxHealth: 50,
    damage: 5,
    defense: 2,
    level: 1,
    xp: 0,
    skills: makeDefaultSkills(),
    inventory: { items: [], maxCapacity: 20 },
    equippedWeapon: null,
    equippedArmor: null,
    lastPerk: null,
    ...overrides,
  };
}

describe('generateChoices', () => {
  it('returns exactly 3 perks', () => {
    const rng = createRNG('test-seed');
    const perks = generateChoices(rng, null);
    expect(perks).toHaveLength(3);
  });

  it('returns perks with valid types', () => {
    const rng = createRNG('another-seed');
    const perks = generateChoices(rng, null);
    for (const perk of perks) {
      expect(VALID_PERK_TYPES).toContain(perk.type);
    }
  });

  it('returns 3 distinct perk types', () => {
    const rng = createRNG('distinct-seed');
    const perks = generateChoices(rng, null);
    const types = perks.map((p) => p.type);
    expect(new Set(types).size).toBe(3);
  });

  it('each perk has a name and description', () => {
    const rng = createRNG('name-seed');
    const perks = generateChoices(rng, null);
    for (const perk of perks) {
      expect(perk.name.length).toBeGreaterThan(0);
      expect(perk.description.length).toBeGreaterThan(0);
    }
  });

  it('works with a lastPerk value', () => {
    const rng = createRNG('last-perk-seed');
    const perks = generateChoices(rng, 'increasedDamage');
    expect(perks).toHaveLength(3);
    for (const perk of perks) {
      expect(VALID_PERK_TYPES).toContain(perk.type);
    }
  });

  it('is deterministic with the same seed', () => {
    const rng1 = createRNG('deterministic');
    const rng2 = createRNG('deterministic');
    const perks1 = generateChoices(rng1, null);
    const perks2 = generateChoices(rng2, null);
    expect(perks1.map((p) => p.type)).toEqual(perks2.map((p) => p.type));
  });
});

describe('applyPerk', () => {
  it('increasedDamage increases player damage', () => {
    const player = makePlayer({ damage: 5 });
    const perk: Perk = {
      type: 'increasedDamage',
      name: 'Power Surge',
      description: 'Increase damage by 3.',
      effect: { stat: 'damage', amount: 3 },
    };
    const result = applyPerk(player, perk);
    expect(result.damage).toBe(8);
  });

  it('increasedHealth increases maxHealth and current health', () => {
    const player = makePlayer({ health: 40, maxHealth: 50 });
    const perk: Perk = {
      type: 'increasedHealth',
      name: 'Vitality Boost',
      description: 'Increase max health by 10.',
      effect: { stat: 'maxHealth', amount: 10 },
    };
    const result = applyPerk(player, perk);
    expect(result.maxHealth).toBe(60);
    expect(result.health).toBe(50);
  });

  it('newWeapon adds weapon to inventory', () => {
    const player = makePlayer();
    const weapon = {
      id: 'w1',
      name: 'Fine Sword',
      description: 'A fine sword.',
      category: 'weapon' as const,
      floorLevel: 1,
      damage: 5,
      range: 1,
    };
    const perk: Perk = {
      type: 'newWeapon',
      name: 'Found: Fine Sword',
      description: 'Receive a Fine Sword.',
      effect: { item: weapon },
    };
    const result = applyPerk(player, perk);
    expect(result.inventory.items).toHaveLength(1);
    expect(result.inventory.items[0].name).toBe('Fine Sword');
  });

  it('newItem adds item to inventory', () => {
    const player = makePlayer();
    const item = {
      id: 'i1',
      name: 'Perk Health Potion',
      description: 'Restores health.',
      category: 'consumable' as const,
      floorLevel: 1,
    };
    const perk: Perk = {
      type: 'newItem',
      name: 'Found: Perk Health Potion',
      description: 'Receive a potion.',
      effect: { item },
    };
    const result = applyPerk(player, perk);
    expect(result.inventory.items).toHaveLength(1);
    expect(result.inventory.items[0].name).toBe('Perk Health Potion');
  });

  it('skillBonus increases the specified skill level by 1', () => {
    const player = makePlayer();
    const perk: Perk = {
      type: 'skillBonus',
      name: 'Melee Training',
      description: 'Increase Melee skill level by 1.',
      effect: { skill: 'melee' },
    };
    const result = applyPerk(player, perk);
    expect(result.skills.melee.level).toBe(2);
  });

  it('skillBonus does not modify other skills', () => {
    const player = makePlayer();
    const perk: Perk = {
      type: 'skillBonus',
      name: 'Ranged Training',
      description: 'Increase Ranged skill level by 1.',
      effect: { skill: 'ranged' },
    };
    const result = applyPerk(player, perk);
    expect(result.skills.ranged.level).toBe(2);
    expect(result.skills.melee.level).toBe(1);
    expect(result.skills.defense.level).toBe(1);
    expect(result.skills.stealth.level).toBe(1);
    expect(result.skills.perception.level).toBe(1);
  });

  it('does not mutate the original player', () => {
    const player = makePlayer({ damage: 5 });
    const perk: Perk = {
      type: 'increasedDamage',
      name: 'Power Surge',
      description: 'Increase damage.',
      effect: { stat: 'damage', amount: 3 },
    };
    applyPerk(player, perk);
    expect(player.damage).toBe(5);
  });
});
