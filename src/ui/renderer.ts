import chalk from 'chalk';
import type { GameState, RunStats, Perk, Floor, Enemy, ItemPlacement, SkillType, RunRecord } from '../models/index.js';
import { ASCII_CHARS } from '../models/index.js';
import { THEME, hpColor, colorizeMessage, depthTheme, gradientLines, shadeHex, type DepthTheme } from './colors.js';
import { drawBox, drawBar, padCenter, padRight, stripAnsi, repeat, ICONS, joinPanelsHorizontally } from './drawing.js';

// ─── Map Glyphs ──────────────────────────────────────────────────────────────
//
// The model layer keeps classic roguelike characters; the renderer dresses
// them up. Walls become solid carved rock, floors recede into faint dust,
// and the way down glows in the current depth tier's accent color.

const TILE_GLYPHS: Record<string, string> = {
  wall: '█',
  floor: '·',
  corridor: '·',
  door: '+',
  stairsUp: '▲',
  stairsDown: '▼',
};

// Light radius around the player, in Chebyshev distance.
const LIGHT_NEAR = 4;
const LIGHT_MID = 9;

// ─── Character Helpers ───────────────────────────────────────────────────────

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

// ─── Map Renderer ────────────────────────────────────────────────────────────

function renderMap(
  floor: Floor,
  playerPos: { x: number; y: number },
  enemies: Enemy[],
  items: ItemPlacement[],
  depth: DepthTheme,
): string[] {
  const { grid } = floor;
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;
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

  // Walls that border walkable space catch the light; everything else is
  // unbroken rock and stays dark, so carved rooms read as hollows in a mass.
  const litWalls = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!grid[y][x].walkable) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= height || nx >= width) continue;
          if (grid[ny][nx].type === 'wall') {
            litWalls[ny * width + nx] = 1;
          }
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      if (x === playerPos.x && y === playerPos.y) {
        row += THEME.entities.player(ASCII_CHARS.player);
        continue;
      }

      const key = `${x},${y}`;
      const enemy = enemyMap.get(key);
      if (enemy) {
        row += enemyChar(enemy);
        continue;
      }
      const item = itemMap.get(key);
      if (item) {
        row += itemChar(item);
        continue;
      }

      const tile = grid[y][x];
      const dist = Math.max(Math.abs(x - playerPos.x), Math.abs(y - playerPos.y));
      const glyph = TILE_GLYPHS[tile.type] ?? tile.char;

      switch (tile.type) {
        case 'wall':
          if (!litWalls[y * width + x]) {
            row += depth.wallDeep(glyph);
          } else if (dist <= LIGHT_NEAR) {
            row += depth.wallNear(glyph);
          } else if (dist <= LIGHT_MID) {
            row += depth.wallMid(glyph);
          } else {
            row += depth.wallFar(glyph);
          }
          break;
        case 'door':
          row += depth.door(glyph);
          break;
        case 'stairsUp':
          row += depth.stairsUp(glyph);
          break;
        case 'stairsDown':
          row += depth.stairsDown(glyph);
          break;
        default:
          if (dist <= LIGHT_NEAR) {
            row += depth.floorNear(glyph);
          } else if (dist <= LIGHT_MID) {
            row += depth.floorMid(glyph);
          } else {
            row += depth.floorFar(glyph);
          }
      }
    }
    lines.push(row);
  }

  return lines;
}

// ─── Message Log ─────────────────────────────────────────────────────────────

function buildMessageLines(
  messageLog: string[],
  messageScrollOffset: number,
  visibleLines: number,
): string[] {
  const totalMessages = messageLog.length;
  const maxOffset = Math.max(0, totalMessages - visibleLines);
  const effectiveOffset = Math.min(messageScrollOffset, maxOffset);

  const startIndex = Math.max(0, totalMessages - visibleLines - effectiveOffset);
  const endIndex = totalMessages - effectiveOffset;
  const displayedMessages = messageLog.slice(startIndex, endIndex);

  // Older messages sink into the dark; the freshest two stay fully lit.
  const messageLines = displayedMessages.map((msg, i) => {
    const colored = colorizeMessage(msg);
    const fromEnd = displayedMessages.length - 1 - i;
    return fromEnd < 2 ? colored : chalk.dim(colored);
  });

  if (effectiveOffset < maxOffset) {
    const hidden = maxOffset - effectiveOffset;
    messageLines.push(THEME.hud.dim(`  ↑ ${hidden} older message${hidden > 1 ? 's' : ''}`));
  }
  if (effectiveOffset > 0) {
    messageLines.push(THEME.hud.dim(`  ↓ ${effectiveOffset} newer message${effectiveOffset > 1 ? 's' : ''}`));
  }

  return messageLines;
}

// ─── Main Render ─────────────────────────────────────────────────────────────

export function render(state: GameState): string {
  const { currentFloor, player, messageLog, messageScrollOffset, floorNumber } = state;
  const depth = depthTheme(floorNumber);

  const termCols = process.stdout.columns ?? 80;
  const mapWidth = currentFloor.grid[0].length;
  const mapPanelWidth = mapWidth + 2;
  const rightWidth = termCols - mapPanelWidth - 1; // 1-char gap between panels

  const bossAlive = currentFloor.isBossFloor && currentFloor.enemies.some(e => e.isBoss && e.health > 0);

  const mapLines = renderMap(currentFloor, player.position, currentFloor.enemies, currentFloor.items, depth);
  const mapBorder = bossAlive ? chalk.hex(shadeHex('#ff4d5e', 0.55)) : depth.border;
  const mapTitle = bossAlive ? THEME.hud.bossFloor : depth.title;
  const mapPanel = drawBox(mapLines, {
    width: mapPanelWidth,
    title: ` Floor ${floorNumber} · ${depth.name} `,
    titleColor: mapTitle,
    borderColor: mapBorder,
  });

  // ─── Shared Status Content ───────────────────────────────────────────────
  const weaponName = player.equippedWeapon ? player.equippedWeapon.name : 'none';
  const armorName = player.equippedArmor ? player.equippedArmor.name : 'none';

  // Bar width adapts to layout
  const barWidth = rightWidth < 35 ? mapWidth : rightWidth - 2;

  const hpBar = drawBar(
    'HP',
    player.health,
    player.maxHealth,
    barWidth,
    hpColor(player.health, player.maxHealth),
    THEME.hud.barEmpty,
    THEME.hud.label,
  );

  const xpMax = Math.max(player.xp, player.level * 100);
  const xpBar = drawBar(
    'XP',
    player.xp,
    xpMax,
    barWidth,
    THEME.hud.xp,
    THEME.hud.barEmpty,
    THEME.hud.label,
  );

  const equipLine =
    `${THEME.hud.label('Wpn:')} ${THEME.hud.value(weaponName)}  ` +
    `${THEME.hud.label('Arm:')} ${THEME.hud.value(armorName)}  ` +
    `${THEME.hud.label('Lvl:')} ${THEME.hud.value(String(player.level))}`;

  // Depth pips track progress through the 5-floor boss cycle.
  const cyclePos = ((floorNumber - 1) % 5) + 1;
  let depthLine: string;
  if (bossAlive) {
    depthLine = THEME.hud.bossFloor(`${ICONS.warning} [BOSS FLOOR] — defeat it to descend`);
  } else {
    const pips = depth.accent(repeat(ICONS.diamond, cyclePos)) + THEME.hud.dim(repeat(ICONS.diamondHollow, 5 - cyclePos));
    const note = cyclePos === 5 ? 'the way down lies open' : `boss in ${5 - cyclePos}`;
    depthLine = `${THEME.hud.label('Depth')} ${pips}  ${THEME.hud.dim(note)}`;
  }

  const statusContent = [hpBar, xpBar, equipLine, depthLine];

  // ─── Fallback Vertical Layout (narrow terminal) ──────────────────────────
  if (rightWidth < 35) {
    const statusPanel = drawBox(statusContent, {
      width: mapPanelWidth,
      title: ' Status ',
      titleColor: depth.title,
      borderColor: depth.border,
    });

    const messageLines = buildMessageLines(messageLog, messageScrollOffset, 8);
    const messagePanel = drawBox(messageLines, {
      width: mapPanelWidth,
      title: ' Messages ',
      titleColor: depth.title,
      borderColor: depth.border,
    });

    const allLines = [...mapPanel, '', ...statusPanel, '', ...messagePanel];
    return allLines.join('\n');
  }

  // ─── Side-by-side Horizontal Layout ──────────────────────────────────────

  const statusPanel = drawBox(statusContent, {
    width: rightWidth,
    title: ' Status ',
    titleColor: depth.title,
    borderColor: depth.border,
  });

  const targetHeight = mapPanel.length;
  const usedHeight = statusPanel.length + 1; // +1 blank separator line
  const messageInnerHeight = Math.max(4, targetHeight - usedHeight - 2); // -2 for message box borders

  const messageLines = buildMessageLines(messageLog, messageScrollOffset, messageInnerHeight);
  const messagePanel = drawBox(messageLines, {
    width: rightWidth,
    title: ' Messages ',
    titleColor: depth.title,
    borderColor: depth.border,
  });

  // Right column: status on top, messages filling remaining height
  const rightStack: string[] = [...statusPanel, '', ...messagePanel];

  return joinPanelsHorizontally(mapPanel, rightStack).join('\n');
}

// ─── Title Screen ────────────────────────────────────────────────────────────

const TITLE_BANNER = [
  '██████╗ ███████╗███████╗██████╗ ███████╗██╗  ██╗███████╗██╗     ██╗     ',
  '██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝██║  ██║██╔════╝██║     ██║     ',
  '██║  ██║█████╗  █████╗  ██████╔╝███████╗███████║█████╗  ██║     ██║     ',
  '██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ╚════██║██╔══██║██╔══╝  ██║     ██║     ',
  '██████╔╝███████╗███████╗██║     ███████║██║  ██║███████╗███████╗███████╗',
  '╚═════╝ ╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝',
];

export function renderTitleScreen(seed?: string): string {
  const boxWidth = 78;
  const innerWidth = boxWidth - 2;
  const content: string[] = [];

  // The banner sinks from surface cyan into abyssal violet.
  const banner = gradientLines(TITLE_BANNER, '#62e8e0', '#7a5cff');

  content.push('');
  for (const line of banner) {
    content.push('  ' + line);
  }
  content.push('');
  content.push(THEME.screens.subtitle(repeat('≈', innerWidth)));
  content.push(padCenter(THEME.screens.subtitle('─── how deep can you go? ───'), innerWidth));
  content.push('');

  const menu: [string, string][] = [
    ['1.', 'New Game'],
    ['2.', 'New Game with Seed'],
    ['3.', 'View High Scores'],
    ['4.', 'Tutorial'],
    ['5.', 'Quit'],
  ];
  const menuIndent = repeat(' ', Math.floor((innerWidth - 24) / 2));
  for (const [num, label] of menu) {
    content.push(`${menuIndent}${THEME.hud.dim(ICONS.arrow)} ${THEME.screens.prompt(num)} ${THEME.hud.value(label)}`);
  }
  content.push('');

  if (seed) {
    content.push(padCenter(`${THEME.hud.dim('Current seed:')} ${THEME.hud.label(seed)}`, innerWidth));
    content.push('');
  }

  return drawBox(content, {
    width: boxWidth,
    title: ` ${ICONS.diamond} `,
    titleColor: THEME.screens.title,
    borderColor: THEME.hud.panelBorder,
  }).join('\n');
}

// ─── Game Over ───────────────────────────────────────────────────────────────

export function renderGameOver(stats: RunStats, seed: string): string {
  const lines: string[] = [];
  const skillTypes: SkillType[] = ['melee', 'ranged', 'defense', 'stealth', 'perception'];
  const floorReached = stats.floorsCleared + 1;
  const tier = depthTheme(floorReached);
  const width = 60;
  const innerWidth = width - 2;

  lines.push('');
  lines.push(padCenter(THEME.screens.gameOver(`${ICONS.boss}  GAME OVER  ${ICONS.boss}`), innerWidth));
  lines.push('');
  lines.push(padCenter(THEME.hud.dim(`You fell on floor ${floorReached}.`), innerWidth));
  lines.push(padCenter(tier.accent(`${tier.name} keeps what it takes.`), innerWidth));
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Floors Cleared:')} ${THEME.hud.value(String(stats.floorsCleared))}`);
  lines.push(`  ${THEME.screens.gameOverLabel('Enemies Defeated:')} ${THEME.hud.value(String(stats.enemiesDefeated))}`);
  lines.push(`  ${THEME.screens.gameOverLabel('Bosses Defeated:')} ${THEME.hud.value(String(stats.bossesDefeated))}`);
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Highest Skill Levels:')}`);
  for (const skill of skillTypes) {
    const label = skill.charAt(0).toUpperCase() + skill.slice(1);
    const value = String(stats.highestSkillLevels[skill]);
    lines.push(`    ${THEME.hud.dim(label + ':')} ${THEME.hud.value(value)}`);
  }
  lines.push('');
  lines.push(`  ${THEME.screens.gameOverLabel('Seed:')} ${THEME.hud.dim(seed)}`);
  lines.push(padCenter(THEME.hud.dim('· use this seed to dive the same dungeon again ·'), innerWidth));
  lines.push('');

  return drawBox(lines, {
    width,
    title: ` ${ICONS.boss} Rest In Pieces ${ICONS.boss} `,
    titleColor: THEME.screens.gameOver,
    borderColor: chalk.hex(shadeHex('#ff5d70', 0.5)),
    style: 'double',
  }).join('\n');
}

// ─── Perk Selection ──────────────────────────────────────────────────────────

export function renderPerkSelection(perks: Perk[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${chalk.bold('Choose a Perk:')}`);
  lines.push('');
  for (let i = 0; i < perks.length; i++) {
    lines.push(
      `  ${THEME.screens.gold(`${i + 1}.`)} ${THEME.screens.perkName(perks[i].name)} ` +
      `${THEME.hud.dim('—')} ${THEME.screens.perkDesc(perks[i].description)}`,
    );
  }
  lines.push('');
  lines.push(`  ${THEME.hud.dim('type a number and press Enter')}`);
  lines.push('');

  const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const boxWidth = Math.min(80, Math.max(50, maxLen + 4));

  return drawBox(lines, {
    width: boxWidth,
    title: ` ${ICONS.loot} Level Up ${ICONS.loot} `,
    titleColor: THEME.screens.gold,
    borderColor: chalk.hex(shadeHex('#ffd76b', 0.45)),
    style: 'double',
  }).join('\n');
}

// ─── Help ────────────────────────────────────────────────────────────────────

interface HelpSection {
  header: string;
  rows: [string, string][];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    header: 'Movement',
    rows: [
      ['north/south/east/west (n/s/e/w) [count]', 'Move in a direction'],
    ],
  },
  {
    header: 'Combat',
    rows: [
      ['attack [count]', 'Attack an adjacent enemy'],
      ['shoot [direction]', 'Fire ranged weapon'],
    ],
  },
  {
    header: 'Items',
    rows: [
      ['inventory (i)', 'List your items'],
      ['equip [item]', 'Equip weapon or armor'],
      ['unequip [weapon/armor]', 'Unequip from slot'],
      ['use [item]', 'Use a consumable'],
      ['drop [item]', 'Drop item on floor'],
      ['pickup', 'Pick up item at your position'],
    ],
  },
  {
    header: 'Awareness',
    rows: [
      ['look (l)', 'Describe your surroundings'],
      ['inspect [target]', 'Inspect enemy or item'],
      ['skills', 'Show skill levels'],
    ],
  },
  {
    header: 'System',
    rows: [
      ['messages', 'Show full message history'],
      ['scroll [up|down|top|bottom]', 'Scroll messages'],
      ['help (?)', 'Show this overlay'],
      ['quit (q)', 'End the game'],
    ],
  },
];

export function renderHelp(): string {
  const lines: string[] = [];
  const width = 76;
  const innerWidth = width - 2;
  const col1Width = 41;

  lines.push('');
  for (const section of HELP_SECTIONS) {
    const headerText = `── ${section.header} `;
    const rule = repeat('─', Math.max(0, innerWidth - headerText.length - 4));
    lines.push(`  ${THEME.hud.dim('──')} ${THEME.hud.panelTitle(section.header)} ${THEME.hud.dim(rule)}`);
    for (const [cmd, desc] of section.rows) {
      lines.push(`   ${padRight(THEME.messages.system(cmd), col1Width)} ${THEME.screens.perkDesc(desc)}`);
    }
    lines.push('');
  }

  return drawBox(lines, {
    width,
    title: ' Help ',
    titleColor: THEME.hud.panelTitle,
    borderColor: THEME.hud.panelBorder,
  }).join('\n');
}

// ─── Tutorial ────────────────────────────────────────────────────────────────

export function renderTutorial(): string {
  const lines: string[] = [];
  const width = 76;
  const innerWidth = width - 2;
  const header = (text: string) => `${THEME.screens.title(ICONS.diamond)} ${THEME.screens.tutorialHighlight(text)}`;
  const body = (text: string) => `  ${THEME.screens.tutorialText(text)}`;

  lines.push('');
  lines.push(padCenter(THEME.screens.tutorialHeader('Welcome to DeepShell!'), innerWidth));
  lines.push(padCenter(THEME.screens.subtitle('a roguelike descent, played entirely in your terminal'), innerWidth));
  lines.push('');
  lines.push(header('Movement'));
  lines.push(body('Use north, south, east, west (or n, s, e, w) to move.'));
  lines.push(body('Add a number to repeat: "east 5" moves 5 tiles.'));
  lines.push('');
  lines.push(header('Combat'));
  lines.push(body('"attack" hits an adjacent enemy.'));
  lines.push(body('"shoot <direction>" fires a ranged weapon.'));
  lines.push('');
  lines.push(header('Items'));
  lines.push(body('Walk over items to find them. Use "pickup" to grab them.'));
  lines.push(body('"inventory" shows your items. "equip <item>" to ready a weapon.'));
  lines.push('');
  lines.push(header('Progression'));
  lines.push(body(`Find the glowing ${stripAnsi(TILE_GLYPHS.stairsDown)} stairs to descend. Every 5 floors is a Boss Floor!`));
  lines.push(body('After each floor, choose a perk to grow stronger.'));
  lines.push('');
  lines.push(header('Skills'));
  lines.push(body('Melee, Ranged, Defense, Stealth, and Perception level up as you play.'));
  lines.push('');
  lines.push(header('Reading the map'));
  lines.push(
    `  ${THEME.entities.player('@')} ${THEME.hud.dim('you')}   ` +
    `${THEME.entities.meleeEnemy('m')}${THEME.hud.dim('/')}${THEME.entities.rangedEnemy('r')}${THEME.hud.dim('/')}${THEME.entities.patrolEnemy('p')} ${THEME.hud.dim('enemies')}   ` +
    `${THEME.entities.boss('B')} ${THEME.hud.dim('boss')}   ` +
    `${THEME.map.door('+')} ${THEME.hud.dim('door')}   ` +
    `${THEME.map.stairsDown('▼')} ${THEME.hud.dim('way down')}   ` +
    `${THEME.items.weapon(')')}${THEME.hud.dim('/')}${THEME.items.armor('[')}${THEME.hud.dim('/')}${THEME.items.item('!')} ${THEME.hud.dim('loot')}`,
  );
  lines.push('');
  lines.push(padCenter(THEME.screens.subtitle('Good luck, operative. How deep can you go?'), innerWidth));
  lines.push('');

  return drawBox(lines, {
    width,
    title: ' Tutorial ',
    titleColor: THEME.screens.tutorialHeader,
    borderColor: THEME.hud.panelBorder,
  }).join('\n');
}

// ─── High Scores ─────────────────────────────────────────────────────────────

export function renderHighScores(records: RunRecord[]): string {
  const width = 72;
  const innerWidth = width - 2;
  const lines: string[] = [];

  lines.push('');
  if (records.length === 0) {
    lines.push(padCenter(THEME.hud.dim('The deep has no record of you yet.'), innerWidth));
    lines.push(padCenter(THEME.screens.subtitle('complete a run to etch your name here'), innerWidth));
    lines.push('');
  } else {
    const headerLine =
      `   ${padRight('#', 4)}${padRight('Floors', 8)}${padRight('Enemies', 9)}${padRight('Bosses', 8)}${padRight('Date', 12)}Seed`;
    lines.push(THEME.hud.label(headerLine));
    lines.push(`   ${THEME.hud.dim(repeat('─', innerWidth - 4))}`);

    const rankColor = (i: number) =>
      i === 0 ? THEME.screens.gold : i === 1 ? THEME.screens.silver : i === 2 ? THEME.screens.bronze : THEME.hud.dim;

    for (let i = 0; i < records.length; i++) {
      const s = records[i];
      const date = new Date(s.date).toLocaleDateString();
      const color = rankColor(i);
      const medal = i < 3 ? ICONS.loot : ' ';
      lines.push(
        ` ${color(medal)} ${color(padRight(String(i + 1), 4))}` +
        THEME.hud.value(padRight(String(s.floorsCleared), 8)) +
        THEME.hud.value(padRight(String(s.enemiesDefeated), 9)) +
        THEME.hud.value(padRight(String(s.bossesDefeated), 8)) +
        THEME.hud.dim(padRight(date, 12)) +
        THEME.hud.dim(s.seed),
      );
    }
    lines.push('');
  }

  return drawBox(lines, {
    width,
    title: ` ${ICONS.diamond} Hall of the Deep ${ICONS.diamond} `,
    titleColor: THEME.screens.gold,
    borderColor: THEME.hud.panelBorder,
    style: 'double',
  }).join('\n');
}

// ─── Terminal Size ───────────────────────────────────────────────────────────

export function checkTerminalSize(cols: number, rows: number): string | null {
  if (cols < 80 || rows < 24) {
    return THEME.messages.warning(
      `${ICONS.warning} Terminal too small (${cols}x${rows}). Please resize to at least 80x24 for the best experience.`,
    );
  }
  return null;
}
