// ─── Position ────────────────────────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

// ─── Direction ───────────────────────────────────────────────────────────────

export type Direction = 'north' | 'south' | 'east' | 'west';

// ─── Tile ────────────────────────────────────────────────────────────────────

export type TileType = 'wall' | 'floor' | 'door' | 'stairsUp' | 'stairsDown' | 'corridor';

export interface Tile {
  type: TileType;
  char: string;
  walkable: boolean;
  entity: Entity | null;
  item: Item | null;
}

// ─── Room & Floor ────────────────────────────────────────────────────────────

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ItemPlacement {
  item: Item;
  position: Position;
}

export interface Floor {
  width: number;
  height: number;
  grid: Tile[][];
  rooms: Room[];
  entry: Position;
  exit: Position;
  enemies: Enemy[];
  items: ItemPlacement[];
  isBossFloor: boolean;
}

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface Entity {
  id: string;
  name: string;
  position: Position;
  health: number;
  maxHealth: number;
  damage: number;
  defense: number;
}

// ─── Enemy ───────────────────────────────────────────────────────────────────

export type EnemyBehavior = 'melee' | 'ranged' | 'patrol';

export interface SpecialAttack {
  name: string;
  damage: number;
  cooldown: number;
  currentCooldown: number;
}

export interface Enemy extends Entity {
  behavior: EnemyBehavior;
  detectionRange: number;
  patrolPath: Position[] | null;
  isAggro: boolean;
  isBoss: boolean;
  specialAttacks: SpecialAttack[] | null;
  dropRate: number;
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export type SkillType = 'melee' | 'ranged' | 'defense' | 'stealth' | 'perception';

export interface SkillState {
  level: number;
  xp: number;
}

export interface PlayerSkills {
  melee: SkillState;
  ranged: SkillState;
  defense: SkillState;
  stealth: SkillState;
  perception: SkillState;
}

// ─── Items ───────────────────────────────────────────────────────────────────

export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'special';

export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  floorLevel: number;
}

export interface Weapon extends Item {
  category: 'weapon';
  damage: number;
  range: number;
}

export interface Armor extends Item {
  category: 'armor';
  defense: number;
}

export type ConsumableEffect =
  | { type: 'heal'; amount: number }
  | { type: 'skillBoost'; skill: SkillType; duration: number; bonus: number };

export interface Consumable extends Item {
  category: 'consumable';
  effect: ConsumableEffect;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface Inventory {
  items: Item[];
  maxCapacity: number;
}

// ─── Player ──────────────────────────────────────────────────────────────────

export type PerkType = 'increasedDamage' | 'increasedHealth' | 'newWeapon' | 'newItem' | 'skillBonus';

export interface PerkEffect {
  stat?: string;
  amount?: number;
  item?: Item;
  skill?: SkillType;
}

export interface Perk {
  type: PerkType;
  name: string;
  description: string;
  effect: PerkEffect;
}

export interface Player extends Entity {
  level: number;
  xp: number;
  skills: PlayerSkills;
  inventory: Inventory;
  equippedWeapon: Weapon | null;
  equippedArmor: Armor | null;
  lastPerk: PerkType | null;
}

// ─── Run Stats & Records ────────────────────────────────────────────────────

export interface RunStats {
  floorsCleared: number;
  enemiesDefeated: number;
  bossesDefeated: number;
  highestSkillLevels: Record<SkillType, number>;
}

export interface RunRecord {
  date: string;
  floorsCleared: number;
  enemiesDefeated: number;
  bossesDefeated: number;
  highestSkillLevels: Record<SkillType, number>;
  seed: string;
}

// ─── Game State ──────────────────────────────────────────────────────────────

export interface GameState {
  seed: string;
  rng: SeededRNG;
  player: Player;
  currentFloor: Floor;
  floorNumber: number;
  messageLog: string[];
  gamePhase: 'title' | 'playing' | 'perkSelection' | 'gameOver';
  runStats: RunStats;
  perkChoices?: Perk[];
}

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

export interface SeededRNG {
  next(): number;
  nextInt(min: number, max: number): number;
  shuffle<T>(arr: T[]): T[];
  fork(): SeededRNG;
}

// ─── Command Parser ──────────────────────────────────────────────────────────

export interface ParsedCommand {
  action: string;
  target: string | null;
  raw: string;
}

export interface CommandError {
  error: string;
  raw: string;
}

// ─── Combat ──────────────────────────────────────────────────────────────────

export interface CombatResult {
  damage: number;
  defenderDefeated: boolean;
  messages: string[];
  xpAwarded: number;
  skillXp: { skill: SkillType; amount: number }[];
  lootDropped: Item | null;
}

export type EnemyAction =
  | { type: 'move'; position: Position }
  | { type: 'meleeAttack'; target: Position }
  | { type: 'rangedAttack'; direction: Direction }
  | { type: 'idle' };

// ─── ASCII Character Map ────────────────────────────────────────────────────

export const ASCII_CHARS = {
  wall: '#',
  floor: '.',
  corridor: '.',
  door: '+',
  stairsUp: '<',
  stairsDown: '>',
  player: '@',
  meleeEnemy: 'm',
  rangedEnemy: 'r',
  patrolEnemy: 'p',
  boss: 'B',
  item: '!',
  weapon: ')',
  armor: '[',
  treasureChest: '$',
} as const;
