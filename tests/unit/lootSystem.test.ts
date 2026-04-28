import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng.js';
import { generateFloorItems, rollEnemyDrop, generateTreasureChestLoot } from '../../src/systems/lootSystem.js';
import type { Weapon, Armor, Consumable } from '../../src/models/index.js';

describe('LootSystem', () => {
  describe('generateFloorItems', () => {
    it('returns an array of items', () => {
      const rng = createRNG('test-seed');
      const items = generateFloorItems(rng, 1);
      expect(items.length).toBeGreaterThan(0);
    });

    it('generates more items on higher floors', () => {
      const items1 = generateFloorItems(createRNG('seed'), 1);
      const items10 = generateFloorItems(createRNG('seed'), 10);
      expect(items10.length).toBeGreaterThanOrEqual(items1.length);
    });

    it('all items have valid categories', () => {
      const rng = createRNG('categories');
      const items = generateFloorItems(rng, 5);
      for (const item of items) {
        expect(['weapon', 'armor', 'consumable', 'special']).toContain(item.category);
      }
    });

    it('weapons have damage > 0', () => {
      const rng = createRNG('weapons-check');
      const items = generateFloorItems(rng, 3);
      for (const item of items) {
        if (item.category === 'weapon') {
          expect((item as Weapon).damage).toBeGreaterThan(0);
        }
      }
    });

    it('armor has defense > 0', () => {
      const rng = createRNG('armor-check');
      const items = generateFloorItems(rng, 3);
      for (const item of items) {
        if (item.category === 'armor') {
          expect((item as Armor).defense).toBeGreaterThan(0);
        }
      }
    });

    it('consumables have valid effects', () => {
      const rng = createRNG('consumable-check');
      const items = generateFloorItems(rng, 5);
      for (const item of items) {
        if (item.category === 'consumable') {
          const c = item as Consumable;
          expect(['heal', 'skillBoost']).toContain(c.effect.type);
        }
      }
    });

    it('item floorLevel matches floor number', () => {
      const rng = createRNG('floor-level');
      const items = generateFloorItems(rng, 7);
      for (const item of items) {
        expect(item.floorLevel).toBe(7);
      }
    });
  });

  describe('rollEnemyDrop', () => {
    it('returns null when drop rate is 0', () => {
      const rng = createRNG('no-drop');
      expect(rollEnemyDrop(rng, 3, 0)).toBeNull();
    });

    it('returns an item when drop rate is 1', () => {
      const rng = createRNG('always-drop');
      const item = rollEnemyDrop(rng, 5, 1);
      expect(item).not.toBeNull();
      expect(['weapon', 'armor', 'consumable', 'special']).toContain(item!.category);
    });

    it('dropped item has correct floorLevel', () => {
      const rng = createRNG('drop-level');
      const item = rollEnemyDrop(rng, 8, 1);
      expect(item).not.toBeNull();
      expect(item!.floorLevel).toBe(8);
    });
  });

  describe('generateTreasureChestLoot', () => {
    it('returns multiple items', () => {
      const rng = createRNG('chest');
      const items = generateTreasureChestLoot(rng, 5);
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('treasure chest loot quality exceeds standard floor loot', () => {
      const rng1 = createRNG('compare');
      const rng2 = createRNG('compare');
      const floorItems = generateFloorItems(rng1, 5);
      const chestItems = generateTreasureChestLoot(rng2, 5);

      const maxFloorLevel = Math.max(...floorItems.map(i => i.floorLevel));
      const minChestLevel = Math.min(...chestItems.map(i => i.floorLevel));
      expect(minChestLevel).toBeGreaterThan(maxFloorLevel);
    });

    it('all chest items have valid categories', () => {
      const rng = createRNG('chest-cats');
      const items = generateTreasureChestLoot(rng, 10);
      for (const item of items) {
        expect(['weapon', 'armor', 'consumable', 'special']).toContain(item.category);
      }
    });
  });
});
