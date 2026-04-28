import { describe, it, expect } from 'vitest';
import {
  addItem,
  removeItem,
  equipItem,
  unequipItem,
  useConsumable,
} from '../../src/systems/inventoryManager.js';
import type {
  Inventory,
  Item,
  Weapon,
  Armor,
  Consumable,
  Player,
} from '../../src/models/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInventory(items: Item[] = [], maxCapacity = 20): Inventory {
  return { items, maxCapacity };
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Test Item',
    description: 'A test item',
    category: 'consumable',
    floorLevel: 1,
    ...overrides,
  };
}

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'wpn-1',
    name: 'Iron Sword',
    description: 'A sturdy sword',
    category: 'weapon',
    floorLevel: 1,
    damage: 5,
    range: 1,
    ...overrides,
  };
}

function makeArmor(overrides: Partial<Armor> = {}): Armor {
  return {
    id: 'arm-1',
    name: 'Leather Armor',
    description: 'Basic armor',
    category: 'armor',
    floorLevel: 1,
    defense: 3,
    ...overrides,
  };
}

function makeConsumable(overrides: Partial<Consumable> = {}): Consumable {
  return {
    id: 'con-1',
    name: 'Health Potion',
    description: 'Restores health',
    category: 'consumable',
    floorLevel: 1,
    effect: { type: 'heal', amount: 10 },
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Hero',
    position: { x: 0, y: 0 },
    health: 50,
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
    inventory: makeInventory(),
    equippedWeapon: null,
    equippedArmor: null,
    lastPerk: null,
    ...overrides,
  };
}

// ─── addItem ─────────────────────────────────────────────────────────────────

describe('addItem', () => {
  it('adds an item to an empty inventory', () => {
    const inv = makeInventory();
    const item = makeItem();
    const result = addItem(inv, item);
    expect(result).not.toHaveProperty('error');
    expect((result as Inventory).items).toHaveLength(1);
    expect((result as Inventory).items[0]).toEqual(item);
  });

  it('returns error when inventory is full', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({ id: `item-${i}` }),
    );
    const inv = makeInventory(items);
    const result = addItem(inv, makeItem({ id: 'extra' }));
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toBe('Inventory is full');
  });

  it('does not mutate the original inventory', () => {
    const inv = makeInventory();
    const item = makeItem();
    addItem(inv, item);
    expect(inv.items).toHaveLength(0);
  });
});

// ─── removeItem ──────────────────────────────────────────────────────────────

describe('removeItem', () => {
  it('removes an item by ID', () => {
    const item = makeItem({ id: 'to-remove' });
    const inv = makeInventory([item]);
    const result = removeItem(inv, 'to-remove');
    expect(result.items).toHaveLength(0);
  });

  it('leaves inventory unchanged if ID not found', () => {
    const item = makeItem();
    const inv = makeInventory([item]);
    const result = removeItem(inv, 'nonexistent');
    expect(result.items).toHaveLength(1);
  });
});

// ─── equipItem ───────────────────────────────────────────────────────────────

describe('equipItem', () => {
  it('equips a weapon and applies damage bonus', () => {
    const weapon = makeWeapon({ damage: 7 });
    const player = makePlayer({
      damage: 10,
      inventory: makeInventory([weapon]),
    });
    const result = equipItem(player, weapon.id);
    expect(result).not.toHaveProperty('error');
    const p = result as Player;
    expect(p.equippedWeapon).toEqual(weapon);
    expect(p.damage).toBe(17);
  });

  it('equips armor and applies defense bonus', () => {
    const armor = makeArmor({ defense: 4 });
    const player = makePlayer({
      defense: 5,
      inventory: makeInventory([armor]),
    });
    const result = equipItem(player, armor.id);
    expect(result).not.toHaveProperty('error');
    const p = result as Player;
    expect(p.equippedArmor).toEqual(armor);
    expect(p.defense).toBe(9);
  });

  it('returns error for consumable items', () => {
    const consumable = makeConsumable();
    const player = makePlayer({
      inventory: makeInventory([consumable]),
    });
    const result = equipItem(player, consumable.id);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toBe('Cannot equip this item');
  });

  it('returns error if item not in inventory', () => {
    const player = makePlayer();
    const result = equipItem(player, 'nonexistent');
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toBe(
      'Item not found in inventory',
    );
  });
});

// ─── unequipItem ─────────────────────────────────────────────────────────────

describe('unequipItem', () => {
  it('unequips weapon and reverts damage', () => {
    const weapon = makeWeapon({ damage: 7 });
    const player = makePlayer({
      damage: 17,
      equippedWeapon: weapon,
    });
    const result = unequipItem(player, 'weapon');
    expect(result.equippedWeapon).toBeNull();
    expect(result.damage).toBe(10);
  });

  it('unequips armor and reverts defense', () => {
    const armor = makeArmor({ defense: 4 });
    const player = makePlayer({
      defense: 9,
      equippedArmor: armor,
    });
    const result = unequipItem(player, 'armor');
    expect(result.equippedArmor).toBeNull();
    expect(result.defense).toBe(5);
  });

  it('returns player unchanged if no weapon equipped', () => {
    const player = makePlayer({ equippedWeapon: null });
    const result = unequipItem(player, 'weapon');
    expect(result).toEqual(player);
  });

  it('returns player unchanged if no armor equipped', () => {
    const player = makePlayer({ equippedArmor: null });
    const result = unequipItem(player, 'armor');
    expect(result).toEqual(player);
  });
});

// ─── useConsumable ───────────────────────────────────────────────────────────

describe('useConsumable', () => {
  it('heals the player and removes the consumable', () => {
    const potion = makeConsumable({ effect: { type: 'heal', amount: 20 } });
    const player = makePlayer({
      health: 50,
      maxHealth: 100,
      inventory: makeInventory([potion]),
    });
    const { player: p, messages } = useConsumable(player, potion.id);
    expect(p.health).toBe(70);
    expect(p.inventory.items).toHaveLength(0);
    expect(messages[0]).toContain('Restored 20 health');
  });

  it('caps healing at maxHealth', () => {
    const potion = makeConsumable({ effect: { type: 'heal', amount: 999 } });
    const player = makePlayer({
      health: 90,
      maxHealth: 100,
      inventory: makeInventory([potion]),
    });
    const { player: p, messages } = useConsumable(player, potion.id);
    expect(p.health).toBe(100);
    expect(messages[0]).toContain('Restored 10 health');
  });

  it('applies skillBoost and removes the consumable', () => {
    const boost = makeConsumable({
      id: 'boost-1',
      name: 'Melee Tonic',
      effect: { type: 'skillBoost', skill: 'melee', duration: 5, bonus: 2 },
    });
    const player = makePlayer({
      inventory: makeInventory([boost]),
    });
    const { player: p, messages } = useConsumable(player, boost.id);
    expect(p.inventory.items).toHaveLength(0);
    expect(messages[0]).toContain('melee boosted by 2 for 5 turns');
  });

  it('returns error message for non-consumable items', () => {
    const weapon = makeWeapon();
    const player = makePlayer({
      inventory: makeInventory([weapon]),
    });
    const { player: p, messages } = useConsumable(player, weapon.id);
    expect(messages[0]).toBe('Item cannot be used');
    expect(p.inventory.items).toHaveLength(1);
  });

  it('returns error message for missing items', () => {
    const player = makePlayer();
    const { messages } = useConsumable(player, 'nonexistent');
    expect(messages[0]).toBe('Item not found in inventory');
  });
});
