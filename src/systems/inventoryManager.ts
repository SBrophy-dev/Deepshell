import type {
  Inventory,
  Item,
  Player,
  Weapon,
  Armor,
  Consumable,
} from '../models/index.js';

/**
 * Adds an item to the inventory. Returns an error if the inventory is full.
 */
export function addItem(
  inventory: Inventory,
  item: Item,
): Inventory | { error: string } {
  if (inventory.items.length >= inventory.maxCapacity) {
    return { error: 'Inventory is full' };
  }
  return {
    ...inventory,
    items: [...inventory.items, item],
  };
}

/**
 * Removes an item from the inventory by ID.
 */
export function removeItem(inventory: Inventory, itemId: string): Inventory {
  return {
    ...inventory,
    items: inventory.items.filter((i) => i.id !== itemId),
  };
}

/**
 * Equips a weapon or armor from the player's inventory.
 * Sets the corresponding slot and applies stat bonuses.
 * Only weapons and armor can be equipped. One weapon and one armor at a time.
 */
export function equipItem(
  player: Player,
  itemId: string,
): Player | { error: string } {
  const item = player.inventory.items.find((i) => i.id === itemId);
  if (!item) {
    return { error: 'Item not found in inventory' };
  }

  if (item.category === 'weapon') {
    const weapon = item as Weapon;
    return {
      ...player,
      equippedWeapon: weapon,
      damage: player.damage + weapon.damage,
    };
  }

  if (item.category === 'armor') {
    const armor = item as Armor;
    return {
      ...player,
      equippedArmor: armor,
      defense: player.defense + armor.defense,
    };
  }

  return { error: 'Cannot equip this item' };
}

/**
 * Unequips an item from the given slot and reverts stat bonuses.
 */
export function unequipItem(
  player: Player,
  slot: 'weapon' | 'armor',
): Player {
  if (slot === 'weapon') {
    const weapon = player.equippedWeapon;
    if (!weapon) return player;
    return {
      ...player,
      equippedWeapon: null,
      damage: player.damage - weapon.damage,
    };
  }

  const armor = player.equippedArmor;
  if (!armor) return player;
  return {
    ...player,
    equippedArmor: null,
    defense: player.defense - armor.defense,
  };
}


/**
 * Uses a consumable item from the player's inventory.
 * Applies the consumable's effect and removes it from inventory.
 * Returns an error message if the item is not a consumable.
 */
export function useConsumable(
  player: Player,
  itemId: string,
): { player: Player; messages: string[] } {
  const item = player.inventory.items.find((i) => i.id === itemId);
  if (!item) {
    return { player, messages: ['Item not found in inventory'] };
  }

  if (item.category !== 'consumable') {
    return { player, messages: ['Item cannot be used'] };
  }

  const consumable = item as Consumable;
  const updatedInventory = removeItem(player.inventory, itemId);
  const messages: string[] = [];

  let updatedPlayer: Player = { ...player, inventory: updatedInventory };

  if (consumable.effect.type === 'heal') {
    const healAmount = consumable.effect.amount;
    const newHealth = Math.min(
      updatedPlayer.health + healAmount,
      updatedPlayer.maxHealth,
    );
    const actualHeal = newHealth - updatedPlayer.health;
    updatedPlayer = { ...updatedPlayer, health: newHealth };
    messages.push(`Used ${consumable.name}. Restored ${actualHeal} health.`);
  } else if (consumable.effect.type === 'skillBoost') {
    const { skill, bonus, duration } = consumable.effect;
    messages.push(
      `Used ${consumable.name}. ${skill} boosted by ${bonus} for ${duration} turns.`,
    );
  }

  return { player: updatedPlayer, messages };
}
