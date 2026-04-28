import type { GameState, RunStats, Perk, Floor, Enemy, ItemPlacement, SkillType } from '../models/index.js';
import { ASCII_CHARS } from '../models/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function enemyChar(enemy: Enemy): string {
  if (enemy.isBoss) return ASCII_CHARS.boss;
  switch (enemy.behavior) {
    case 'melee': return ASCII_CHARS.meleeEnemy;
    case 'ranged': return ASCII_CHARS.rangedEnemy;
    case 'patrol': return ASCII_CHARS.patrolEnemy;
  }
}

function itemChar(placement: ItemPlacement): string {
  switch (placement.item.category) {
    case 'weapon': return ASCII_CHARS.weapon;
    case 'armor': return ASCII_CHARS.armor;
    default: return ASCII_CHARS.item;
  }
}

// ─── render ──────────────────────────────────────────────────────────────────

export function render(state: GameState): string {
  const { currentFloor, player, messageLog, floorNumber } = state;
  const lines: string[] = [];

  // Map region
  const mapLines = renderMap(currentFloor, player.position, currentFloor.enemies, currentFloor.items);
  lines.push(...mapLines);

  // Blank separator
  lines.push('');

  // HUD region
  const weaponName = player.equippedWeapon ? player.equippedWeapon.name : 'none';
  const armorName = player.equippedArmor ? player.equippedArmor.name : 'none';
  let hud = `HP: ${player.health}/${player.maxHealth}  Lvl: ${player.level}  XP: ${player.xp}  Weapon: ${weaponName}  Armor: ${armorName}  Floor: ${floorNumber}`;

  const bossAlive = currentFloor.isBossFloor &&
    currentFloor.enemies.some(e => e.isBoss && e.health > 0);
  if (bossAlive) {
    hud += '  [BOSS FLOOR]';
  }
  lines.push(hud);

  // Blank separator
  lines.push('');

  // Message log region — last 5 messages
  const recentMessages = messageLog.slice(-5);
  for (const msg of recentMessages) {
    lines.push(msg);
  }

  return lines.join('\n');
}

function renderMap(
  floor: Floor,
  playerPos: { x: number; y: number },
  enemies: Enemy[],
  items: ItemPlacement[],
): string[] {
  const { grid } = floor;
  const lines: string[] = [];

  // Build lookup maps for enemies and items by position
  const enemyMap = new Map<string, Enemy>();
  for (const enemy of enemies) {
    if (enemy.health > 0) {
      enemyMap.set(`${enemy.position.x},${enemy.position.y}`, enemy);
    }
  }

  const itemMap = new Map<string, ItemPlacement>();
  for (const placement of items) {
    // Last item at position wins (items can stack; show topmost)
    itemMap.set(`${placement.position.x},${placement.position.y}`, placement);
  }

  for (let y = 0; y < grid.length; y++) {
    let row = '';
    for (let x = 0; x < grid[y].length; x++) {
      if (x === playerPos.x && y === playerPos.y) {
        row += ASCII_CHARS.player;
      } else {
        const key = `${x},${y}`;
        const enemy = enemyMap.get(key);
        if (enemy) {
          row += enemyChar(enemy);
        } else {
          const item = itemMap.get(key);
          if (item) {
            row += itemChar(item);
          } else {
            row += grid[y][x].char;
          }
        }
      }
    }
    lines.push(row);
  }

  return lines;
}


// ─── renderTitleScreen ───────────────────────────────────────────────────────

export function renderTitleScreen(seed?: string): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('  ____  _____ _____ ____  ____  _   _ _____ _     _     ');
  lines.push(' |  _ \\| ____| ____|  _ \\/ ___|| | | | ____| |   | |    ');
  lines.push(' | | | |  _| |  _| | |_) \\___ \\| |_| |  _| | |   | |    ');
  lines.push(' | |_| | |___| |___|  __/ ___) |  _  | |___| |___| |___ ');
  lines.push(' |____/|_____|_____|_|   |____/|_| |_|_____|_____|_____|');
  lines.push('');
  lines.push('  1. New Game');
  lines.push('  2. New Game with Seed');
  lines.push('  3. View High Scores');
  lines.push('  4. Quit');
  lines.push('');

  if (seed) {
    lines.push(`  Current seed: ${seed}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── renderGameOver ──────────────────────────────────────────────────────────

export function renderGameOver(stats: RunStats, seed: string): string {
  const lines: string[] = [];
  const skillTypes: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];

  lines.push('');
  lines.push('  === GAME OVER ===');
  lines.push('');
  lines.push(`  Floors Cleared: ${stats.floorsCleared}`);
  lines.push(`  Enemies Defeated: ${stats.enemiesDefeated}`);
  lines.push(`  Bosses Defeated: ${stats.bossesDefeated}`);
  lines.push('');
  lines.push('  Highest Skill Levels:');
  for (const skill of skillTypes) {
    const label = skill.charAt(0).toUpperCase() + skill.slice(1);
    lines.push(`    ${label}: ${stats.highestSkillLevels[skill]}`);
  }
  lines.push('');
  lines.push(`  Seed: ${seed}`);
  lines.push('');

  return lines.join('\n');
}

// ─── renderPerkSelection ────────────────────────────────────────────────────

export function renderPerkSelection(perks: Perk[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('  Choose a Perk:');
  lines.push('');
  for (let i = 0; i < perks.length; i++) {
    lines.push(`  ${i + 1}. ${perks[i].name} — ${perks[i].description}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ─── renderHelp ──────────────────────────────────────────────────────────────

export function renderHelp(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('  Available Commands:');
  lines.push('');
  lines.push('  north/south/east/west (n/s/e/w) - Move in a direction');
  lines.push('  attack                          - Attack an adjacent enemy');
  lines.push('  shoot [direction]               - Fire ranged weapon in a direction');
  lines.push('  inventory                       - List your items');
  lines.push('  equip [item]                    - Equip a weapon or armor');
  lines.push('  unequip [weapon/armor]          - Unequip from a slot');
  lines.push('  use [item]                      - Use a consumable item');
  lines.push('  drop [item]                     - Drop an item on the floor');
  lines.push('  pickup                          - Pick up an item at your position');
  lines.push('  look                            - Describe your surroundings');
  lines.push('  inspect [target]                - Inspect an enemy or item');
  lines.push('  skills                          - Show your skill levels');
  lines.push('  help                            - Show this help message');
  lines.push('  quit                            - End the game');
  lines.push('');

  return lines.join('\n');
}

// ─── checkTerminalSize ───────────────────────────────────────────────────────

export function checkTerminalSize(cols: number, rows: number): string | null {
  if (cols < 80 || rows < 24) {
    return `Terminal too small (${cols}x${rows}). Please resize to at least 80x24.`;
  }
  return null;
}
