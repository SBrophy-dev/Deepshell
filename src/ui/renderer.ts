import chalk from 'chalk';
import type { GameState, RunStats, Perk, Floor, Enemy, ItemPlacement, SkillType } from '../models/index.js';
import { ASCII_CHARS } from '../models/index.js';
import { THEME, hpColor, colorizeMessage } from './colors.js';

function enemyChar(enemy: Enemy): string {
  const char = enemy.isBoss
    ? ASCII_CHARS.boss
    : enemy.behavior === 'melee'
      ? ASCII_CHARS.meleeEnemy
      : enemy.behavior === 'ranged'
        ? ASCII_CHARS.rangedEnemy
        : ASCII_CHARS.patrolEnemy;

  const colorFn = enemy.isBoss
    ? THEME.entities.boss
    : enemy.behavior === 'melee'
      ? THEME.entities.meleeEnemy
      : enemy.behavior === 'ranged'
        ? THEME.entities.rangedEnemy
        : THEME.entities.patrolEnemy;

  return colorFn(char);
}

function itemChar(placement: ItemPlacement): string {
  const char = placement.item.category === 'weapon'
    ? ASCII_CHARS.weapon
    : placement.item.category === 'armor'
      ? ASCII_CHARS.armor
      : ASCII_CHARS.item;

  const colorFn = placement.item.category === 'weapon'
    ? THEME.items.weapon
    : placement.item.category === 'armor'
      ? THEME.items.armor
      : THEME.items.item;

  return colorFn(char);
}

function tileChar(type: string, char: string): string {
  const colorFn = type === 'wall'
    ? THEME.map.wall
    : type === 'door'
      ? THEME.map.door
      : type === 'stairsUp'
        ? THEME.map.stairsUp
        : type === 'stairsDown'
          ? THEME.map.stairsDown
          : THEME.map.floor;

  return colorFn(char);
}

export function render(state: GameState): string {
  const { currentFloor, player, messageLog, messageScrollOffset, floorNumber } = state;
  const lines: string[] = [];

  const mapLines = renderMap(currentFloor, player.position, currentFloor.enemies, currentFloor.items);
  lines.push(...mapLines);

  lines.push('');

  const weaponName = player.equippedWeapon ? player.equippedWeapon.name : 'none';
  const armorName = player.equippedArmor ? player.equippedArmor.name : 'none';

  const hpStr = hpColor(player.health, player.maxHealth)(`${player.health}/${player.maxHealth}`);
  const hud = [
    `${THEME.hud.label('HP:')} ${hpStr}`,
    `${THEME.hud.label('Lvl:')} ${THEME.hud.value(String(player.level))}`,
    `${THEME.hud.label('XP:')} ${THEME.hud.value(String(player.xp))}`,
    `${THEME.hud.label('Weapon:')} ${THEME.hud.value(weaponName)}`,
    `${THEME.hud.label('Armor:')} ${THEME.hud.value(armorName)}`,
    `${THEME.hud.label('Floor:')} ${THEME.hud.value(String(floorNumber))}`,
  ].join('  ');

  const bossAlive = currentFloor.isBossFloor &&
    currentFloor.enemies.some(e => e.isBoss && e.health > 0);

  lines.push(bossAlive ? `${hud}  ${THEME.hud.bossFloor('[BOSS FLOOR]')}` : hud);

  lines.push('');

  const visibleLines = 10;
  const totalMessages = messageLog.length;
  const maxOffset = Math.max(0, totalMessages - visibleLines);
  const effectiveOffset = Math.min(messageScrollOffset, maxOffset);
  
  const startIndex = Math.max(0, totalMessages - visibleLines - effectiveOffset);
  const endIndex = totalMessages - effectiveOffset;
  const displayedMessages = messageLog.slice(startIndex, endIndex);
  
  for (const msg of displayedMessages) {
    lines.push(colorizeMessage(msg));
  }

  if (effectiveOffset < maxOffset) {
    const hidden = maxOffset - effectiveOffset;
    lines.push(chalk.dim(`  ↑ ${hidden} older message${hidden > 1 ? 's' : ''}`));
  }
  if (effectiveOffset > 0) {
    lines.push(chalk.dim(`  ↓ ${effectiveOffset} newer message${effectiveOffset > 1 ? 's' : ''}`));
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

  const enemyMap = new Map<string, Enemy>();
  for (const enemy of enemies) {
    if (enemy.health > 0) {
      enemyMap.set(`${enemy.position.x},${enemy.position.y}`, enemy);
    }
  }

  const itemMap = new Map<string, ItemPlacement>();
  for (const placement of items) {
    itemMap.set(`${placement.position.x},${placement.position.y}`, placement);
  }

  for (let y = 0; y < grid.length; y++) {
    let row = '';
    for (let x = 0; x < grid[y].length; x++) {
      if (x === playerPos.x && y === playerPos.y) {
        row += THEME.entities.player(ASCII_CHARS.player);
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
            row += tileChar(grid[y][x].type, grid[y][x].char);
          }
        }
      }
    }
    lines.push(row);
  }

  return lines;
}


export function renderTitleScreen(seed?: string): string {
  const lines: string[] = [];

  const titleLines = [
    '  ____  _____ _____ ____  ____  _   _ _____ _     _     ',
    ' |  _ \\| ____| ____|  _ \\/ ___|| | | | ____| |   | |    ',
    ' | | | |  _| |  _| | |_) \\___ \\| |_| |  _| | |   | |    ',
    ' | |_| | |___| |___|  __/ ___) |  _  | |___| |___| |___ ',
    ' |____/|_____|_____|_|   |____/|_| |_|_____|_____|_____|',
  ];

  lines.push('');
  for (const line of titleLines) {
    lines.push(THEME.screens.title(line));
  }

  lines.push('');
  lines.push(`  ${chalk.white('1.')} New Game`);
  lines.push(`  ${chalk.white('2.')} New Game with Seed`);
  lines.push(`  ${chalk.white('3.')} View High Scores`);
  lines.push(`  ${chalk.white('4.')} Quit`);
  lines.push('');

  if (seed) {
    lines.push(`  Current seed: ${chalk.gray(seed)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function renderGameOver(stats: RunStats, seed: string): string {
  const lines: string[] = [];
  const skillTypes: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];

  lines.push('');
  lines.push(`  ${THEME.screens.gameOver('=== GAME OVER ===')}`);
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Floors Cleared:')} ${chalk.white(stats.floorsCleared)}`);
  lines.push(`  ${THEME.screens.gameOverLabel('Enemies Defeated:')} ${chalk.white(stats.enemiesDefeated)}`);
  lines.push(`  ${THEME.screens.gameOverLabel('Bosses Defeated:')} ${chalk.white(stats.bossesDefeated)}`);
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Highest Skill Levels:')}`);
  for (const skill of skillTypes) {
    const label = skill.charAt(0).toUpperCase() + skill.slice(1);
    lines.push(`    ${THEME.screens.gameOverLabel(label + ':')} ${chalk.white(stats.highestSkillLevels[skill])}`);
  }
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Seed:')} ${chalk.gray(seed)}`);
  lines.push('');

  return lines.join('\n');
}

export function renderPerkSelection(perks: Perk[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${chalk.bold('Choose a Perk:')}`);
  lines.push('');
  for (let i = 0; i < perks.length; i++) {
    lines.push(`  ${chalk.white(`${i + 1}.`)} ${THEME.screens.perkName(perks[i].name)} ${chalk.gray('—')} ${THEME.screens.perkDesc(perks[i].description)}`);
  }
  lines.push('');

  return lines.join('\n');
}

export function renderHelp(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${chalk.bold.cyan('Available Commands:')}`);
  lines.push('');
  lines.push('  north/south/east/west (n/s/e/w) [count] - Move');
  lines.push('  attack [count]                          - Attack adjacent enemy');
  lines.push('  shoot [direction]                       - Fire ranged weapon');
  lines.push('  inventory                               - List your items');
  lines.push('  equip [item]                            - Equip weapon/armor');
  lines.push('  unequip [weapon/armor]                  - Unequip from slot');
  lines.push('  use [item]                              - Use consumable');
  lines.push('  drop [item]                             - Drop item');
  lines.push('  pickup                                  - Pick up item');
  lines.push('  look                                    - Describe surroundings');
  lines.push('  inspect [target]                        - Inspect enemy/item');
  lines.push('  skills                                  - Show skill levels');
  lines.push('  messages                                - Show full message log');
  lines.push('  scroll [up|down|top|bottom]             - Scroll messages');
  lines.push('  help                                    - Show this message');
  lines.push('  quit                                    - End the game');
  lines.push('');

  return lines.join('\n');
}

export function checkTerminalSize(cols: number, rows: number): string | null {
  if (cols < 80 || rows < 24) {
    return chalk.yellow(`Terminal too small (${cols}x${rows}). Please resize to at least 80x24.`);
  }
  return null;
}
