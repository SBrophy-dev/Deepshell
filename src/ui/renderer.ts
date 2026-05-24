import chalk from 'chalk';
import type { GameState, RunStats, Perk, Floor, Enemy, ItemPlacement, SkillType } from '../models/index.js';
import { ASCII_CHARS } from '../models/index.js';
import { THEME, hpColor, colorizeMessage } from './colors.js';
import { drawBox, drawBar, padCenter, stripAnsi, ICONS, joinPanelsHorizontally } from './drawing.js';

// ─── Character Helpers ─────────────────────────────────────────────────────────

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

// ─── Map Renderer ────────────────────────────────────────────────────────────

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

// ─── Main Render ─────────────────────────────────────────────────────────────

export function render(state: GameState): string {
  const { currentFloor, player, messageLog, messageScrollOffset, floorNumber } = state;

  const termCols = process.stdout.columns ?? 80;
  const mapWidth = currentFloor.grid[0].length;
  const mapPanelWidth = mapWidth + 2;
  const rightWidth = termCols - mapPanelWidth - 1; // 1-char gap between panels

  const mapLines = renderMap(currentFloor, player.position, currentFloor.enemies, currentFloor.items);
  const mapPanel = drawBox(mapLines, {
    width: mapPanelWidth,
    title: ` Floor ${floorNumber} `,
    titleColor: THEME.hud.panelTitle,
    borderColor: THEME.hud.panelBorder,
  });

  // ─── Shared Status Content ───────────────────────────────────────────────
  const weaponName = player.equippedWeapon ? player.equippedWeapon.name : 'none';
  const armorName = player.equippedArmor ? player.equippedArmor.name : 'none';
  const bossAlive = currentFloor.isBossFloor && currentFloor.enemies.some(e => e.isBoss && e.health > 0);

  // Bar width adapts to layout
  const barWidth = rightWidth < 35 ? mapWidth : rightWidth - 2;

  const hpBar = drawBar(
    'HP',
    player.health,
    player.maxHealth,
    barWidth,
    hpColor(player.health, player.maxHealth),
    chalk.hex('#4a4a4a'),
    THEME.hud.label,
  );

  const xpMax = Math.max(player.xp, player.level * 100);
  const xpBar = drawBar(
    'XP',
    player.xp,
    xpMax,
    barWidth,
    THEME.hud.xp,
    THEME.hud.xpEmpty,
    THEME.hud.label,
  );

  const bossIndicator = bossAlive ? ` ${THEME.hud.bossFloor('[BOSS FLOOR]')}` : '';
  const equipLine = `${THEME.hud.label('Wpn:')} ${THEME.hud.value(weaponName)}  ${THEME.hud.label('Arm:')} ${THEME.hud.value(armorName)}  ${THEME.hud.label('Lvl:')} ${THEME.hud.value(String(player.level))}${bossIndicator}`;

  // ─── Fallback Vertical Layout (narrow terminal) ──────────────────────────
  if (rightWidth < 35) {
    const statusPanel = drawBox([hpBar, xpBar, equipLine], {
      width: mapPanelWidth,
      title: ' Status ',
      titleColor: THEME.hud.panelTitle,
      borderColor: THEME.hud.panelBorder,
    });

    const visibleLines = 8;
    const totalMessages = messageLog.length;
    const maxOffset = Math.max(0, totalMessages - visibleLines);
    const effectiveOffset = Math.min(messageScrollOffset, maxOffset);

    const startIndex = Math.max(0, totalMessages - visibleLines - effectiveOffset);
    const endIndex = totalMessages - effectiveOffset;
    const displayedMessages = messageLog.slice(startIndex, endIndex);

    const messageLines = displayedMessages.map(msg => colorizeMessage(msg));
    if (effectiveOffset < maxOffset) {
      const hidden = maxOffset - effectiveOffset;
      messageLines.push(chalk.dim(`  ↑ ${hidden} older message${hidden > 1 ? 's' : ''}`));
    }
    if (effectiveOffset > 0) {
      messageLines.push(chalk.dim(`  ↓ ${effectiveOffset} newer message${effectiveOffset > 1 ? 's' : ''}`));
    }

    const messagePanel = drawBox(messageLines, {
      width: mapPanelWidth,
      title: ' Messages ',
      titleColor: THEME.hud.panelTitle,
      borderColor: THEME.hud.panelBorder,
    });

    const allLines = [...mapPanel, '', ...statusPanel, '', ...messagePanel];
    return allLines.join('\n');
  }

  // ─── Side-by-side Horizontal Layout ──────────────────────────────────────

  const statusPanel = drawBox([hpBar, xpBar, equipLine], {
    width: rightWidth,
    title: ' Status ',
    titleColor: THEME.hud.panelTitle,
    borderColor: THEME.hud.panelBorder,
  });

  const targetHeight = mapPanel.length;
  const usedHeight = statusPanel.length + 1; // +1 blank separator line
  const messageInnerHeight = Math.max(4, targetHeight - usedHeight - 2); // -2 for message box borders

  const totalMessages = messageLog.length;
  const maxOffset = Math.max(0, totalMessages - messageInnerHeight);
  const effectiveOffset = Math.min(messageScrollOffset, maxOffset);

  const startIndex = Math.max(0, totalMessages - messageInnerHeight - effectiveOffset);
  const endIndex = totalMessages - effectiveOffset;
  const displayedMessages = messageLog.slice(startIndex, endIndex);

  const messageLines = displayedMessages.map(msg => colorizeMessage(msg));
  if (effectiveOffset < maxOffset) {
    const hidden = maxOffset - effectiveOffset;
    messageLines.push(chalk.dim(`  ↑ ${hidden} older message${hidden > 1 ? 's' : ''}`));
  }
  if (effectiveOffset > 0) {
    messageLines.push(chalk.dim(`  ↓ ${effectiveOffset} newer message${effectiveOffset > 1 ? 's' : ''}`));
  }

  const messagePanel = drawBox(messageLines, {
    width: rightWidth,
    title: ' Messages ',
    titleColor: THEME.hud.panelTitle,
    borderColor: THEME.hud.panelBorder,
  });

  // Right column: status on top, messages filling remaining height
  const rightStack: string[] = [...statusPanel, '', ...messagePanel];

  return joinPanelsHorizontally(mapPanel, rightStack).join('\n');
}

// ─── Screens ─────────────────────────────────────────────────────────────────

export function renderTitleScreen(seed?: string): string {
  const content: string[] = [];

  const titleLines = [
    '  ____  _____ _____ ____  ____  _   _ _____ _     _     ',
    ' |  _ \\| ____| ____|  _ \\/ ___|| | | | ____| |   | |    ',
    ' | | | |  _| |  _| | |_) \\___ \\| |_| |  _| | |   | |    ',
    ' | |_| | |___| |___|  __/ ___) |  _  | |___| |___| |___ ',
    ' |____/|_____|_____|_|   |____/|_| |_|_____|_____|_____|',
  ];

  content.push('');
  for (const line of titleLines) {
    content.push(THEME.screens.title(line));
  }
  content.push('');
  content.push(`  ${ICONS.arrow} ${chalk.white('1.')} New Game`);
  content.push(`  ${ICONS.arrow} ${chalk.white('2.')} New Game with Seed`);
  content.push(`  ${ICONS.arrow} ${chalk.white('3.')} View High Scores`);
  content.push(`  ${ICONS.arrow} ${chalk.white('4.')} Tutorial`);
  content.push(`  ${ICONS.arrow} ${chalk.white('5.')} Quit`);
  content.push('');

  if (seed) {
    content.push(`  Current seed: ${chalk.gray(seed)}`);
    content.push('');
  }

  const maxLen = Math.max(...content.map(l => stripAnsi(l).length));
  const boxWidth = Math.min(80, Math.max(60, maxLen + 4));

  return drawBox(content, { width: boxWidth, title: ' DeepShell ', titleColor: THEME.screens.title, borderColor: THEME.hud.panelBorder }).join('\n');
}

export function renderGameOver(stats: RunStats, seed: string): string {
  const lines: string[] = [];
  const skillTypes: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];

  lines.push('');
  lines.push(padCenter(THEME.screens.gameOver('=== GAME OVER ==='), 50));
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Floors Cleared:')} ${chalk.white(String(stats.floorsCleared))}`);
  lines.push(`  ${THEME.screens.gameOverLabel('Enemies Defeated:')} ${chalk.white(String(stats.enemiesDefeated))}`);
  lines.push(`  ${THEME.screens.gameOverLabel('Bosses Defeated:')} ${chalk.white(String(stats.bossesDefeated))}`);
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Highest Skill Levels:')}`);
  for (const skill of skillTypes) {
    const label = skill.charAt(0).toUpperCase() + skill.slice(1);
    const value = String(stats.highestSkillLevels[skill]);
    lines.push(`    ${THEME.screens.gameOverLabel(label + ':')} ${chalk.white(value)}`);
  }
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Seed:')} ${chalk.gray(seed)}`);
  lines.push('');

  const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const boxWidth = Math.min(80, Math.max(50, maxLen + 4));

  return drawBox(lines, { width: boxWidth, title: ' Rest In Pieces ', titleColor: THEME.screens.gameOver, borderColor: THEME.hud.panelBorder }).join('\n');
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

  const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const boxWidth = Math.min(80, Math.max(50, maxLen + 4));

  return drawBox(lines, { width: boxWidth, title: ' Level Up! ', titleColor: THEME.screens.perkName, borderColor: THEME.hud.panelBorder }).join('\n');
}

export function renderHelp(): string {
  const lines: string[] = [];
  const width = 76;
  const innerWidth = width - 2;

  lines.push('');
  lines.push(padCenter(THEME.screens.title('Available Commands'), innerWidth));
  lines.push('');

  const commands: [string, string][] = [
    ['north/south/east/west (n/s/e/w) [count]', 'Move in a direction'],
    ['attack [count]', 'Attack an adjacent enemy'],
    ['shoot [direction]', 'Fire ranged weapon'],
    ['inventory', 'List your items'],
    ['equip [item]', 'Equip weapon or armor'],
    ['unequip [weapon/armor]', 'Unequip from slot'],
    ['use [item]', 'Use a consumable'],
    ['drop [item]', 'Drop item on floor'],
    ['pickup', 'Pick up item at your position'],
    ['look', 'Describe your surroundings'],
    ['inspect [target]', 'Inspect enemy or item'],
    ['skills', 'Show skill levels'],
    ['messages', 'Show full message history'],
    ['scroll [up|down|top|bottom]', 'Scroll messages'],
    ['help', 'Show this message'],
    ['quit', 'End the game'],
  ];

  const col1Width = 38;
  for (const [cmd, desc] of commands) {
    lines.push(`  ${padCenter(THEME.messages.system(cmd), col1Width)} ${THEME.messages.info(desc)}`);
  }
  lines.push('');

  return drawBox(lines, { width, title: ' Help ', titleColor: THEME.hud.panelTitle, borderColor: THEME.hud.panelBorder }).join('\n');
}

export function renderTutorial(): string {
  const lines: string[] = [];
  const width = 76;
  const innerWidth = width - 2;

  lines.push('');
  lines.push(padCenter(THEME.screens.tutorialHeader('Welcome to DeepShell!'), innerWidth));
  lines.push('');
  lines.push(THEME.screens.tutorialText('DeepShell is a roguelike dungeon crawler played entirely in your terminal.'));
  lines.push('');
  lines.push(THEME.screens.tutorialHighlight('► Movement:'));
  lines.push(THEME.screens.tutorialText('  Use north, south, east, west (or n, s, e, w) to move.'));
  lines.push(THEME.screens.tutorialText('  Add a number to repeat: "east 5" moves 5 tiles.'));
  lines.push('');
  lines.push(THEME.screens.tutorialHighlight('► Combat:'));
  lines.push(THEME.screens.tutorialText('  "attack" hits an adjacent enemy. "shoot <direction>" fires a ranged weapon.'));
  lines.push('');
  lines.push(THEME.screens.tutorialHighlight('► Items:'));
  lines.push(THEME.screens.tutorialText('  Walk over items to find them. Use "pickup" to grab them.'));
  lines.push(THEME.screens.tutorialText('  "inventory" shows your items. "equip <item>" to ready a weapon.'));
  lines.push('');
  lines.push(THEME.screens.tutorialHighlight('► Progression:'));
  lines.push(THEME.screens.tutorialText('  Find the > stairs to descend. Every 5 floors is a Boss Floor!'));
  lines.push(THEME.screens.tutorialText('  After each floor, choose a perk to grow stronger.'));
  lines.push('');
  lines.push(THEME.screens.tutorialHighlight('► Skills:'));
  lines.push(THEME.screens.tutorialText('  Melee, Ranged, Defense, Stealth, and Perception level up as you play.'));
  lines.push('');
  lines.push(THEME.screens.tutorialText('Good luck, adventurer. How deep can you go?'));
  lines.push('');

  return drawBox(lines, { width, title: ' Tutorial ', titleColor: THEME.screens.tutorialHeader, borderColor: THEME.hud.panelBorder }).join('\n');
}

export function checkTerminalSize(cols: number, rows: number): string | null {
  if (cols < 80 || rows < 24) {
    return chalk.yellow(`⚠ Terminal too small (${cols}x${rows}). Please resize to at least 80x24 for the best experience.`);
  }
  return null;
}
