import chalk, { type ChalkInstance } from 'chalk';
import { ICONS } from './drawing.js';

// ─── Color Math ──────────────────────────────────────────────────────────────

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Darken (factor < 1) or brighten (factor > 1) a hex color. */
export function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

/** Mix a hex color toward white by amount (0..1). */
export function tintHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Linearly interpolate between two hex colors. */
export function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ─── Depth Tiers ─────────────────────────────────────────────────────────────
//
// The DeepShell descends through five named strata, one per boss cycle.
// Every panel border, map tile, and accent in the HUD takes its hue from the
// current tier, so the whole interface sinks with you: teal shallows, indigo
// fathoms, violet veins, ember furnace, and at last the crimson abyss.

interface TierDef {
  name: string;
  wall: string;
  accent: string;
}

const TIER_DEFS: TierDef[] = [
  { name: 'The Shallows', wall: '#2f7a86', accent: '#4fd8d2' },
  { name: 'The Fathoms', wall: '#35589c', accent: '#7aa2ff' },
  { name: 'The Veins', wall: '#64419c', accent: '#b489ff' },
  { name: 'The Furnace', wall: '#9c5a32', accent: '#ffac61' },
  { name: 'The Abyss', wall: '#8a3242', accent: '#ff5d70' },
];

export interface DepthTheme {
  name: string;
  accentHex: string;
  /** Walls catching the player's light, by distance band. */
  wallNear: ChalkInstance;
  wallMid: ChalkInstance;
  wallFar: ChalkInstance;
  /** Solid rock with no walkable neighbor — unlit mass. */
  wallDeep: ChalkInstance;
  floorNear: ChalkInstance;
  floorMid: ChalkInstance;
  floorFar: ChalkInstance;
  door: ChalkInstance;
  stairsUp: ChalkInstance;
  stairsDown: ChalkInstance;
  border: ChalkInstance;
  title: ChalkInstance;
  accent: ChalkInstance;
}

function buildTheme(def: TierDef): DepthTheme {
  const floorBase = shadeHex(def.wall, 0.62);
  return {
    name: def.name,
    accentHex: def.accent,
    wallNear: chalk.hex(tintHex(def.wall, 0.22)),
    wallMid: chalk.hex(def.wall),
    wallFar: chalk.hex(shadeHex(def.wall, 0.6)),
    wallDeep: chalk.hex(shadeHex(def.wall, 0.36)),
    floorNear: chalk.hex(tintHex(floorBase, 0.18)),
    floorMid: chalk.hex(floorBase),
    floorFar: chalk.hex(shadeHex(floorBase, 0.55)),
    door: chalk.hex('#e8b35a').bold,
    stairsUp: chalk.hex(shadeHex(def.accent, 0.55)),
    stairsDown: chalk.hex(def.accent).bold,
    border: chalk.hex(shadeHex(def.accent, 0.48)),
    title: chalk.hex(def.accent).bold,
    accent: chalk.hex(def.accent),
  };
}

const TIER_THEMES: DepthTheme[] = TIER_DEFS.map(buildTheme);

/** Floors 1–5 are tier 0, 6–10 tier 1, … 21+ stay in The Abyss. */
export function depthTheme(floorNumber: number): DepthTheme {
  const idx = Math.min(TIER_THEMES.length - 1, Math.floor(Math.max(0, floorNumber - 1) / 5));
  return TIER_THEMES[idx];
}

// ─── Static Theme ────────────────────────────────────────────────────────────

export const THEME = {
  map: {
    wall: chalk.hex('#5b6b78'),
    floor: chalk.hex('#3a4750'),
    corridor: chalk.hex('#3a4750'),
    door: chalk.hex('#e8b35a').bold,
    stairsUp: chalk.hex('#3f8a9e'),
    stairsDown: chalk.hex('#4fd8d2').bold,
  },

  entities: {
    player: chalk.hex('#69ff8e').bold,
    meleeEnemy: chalk.hex('#ff6b6b'),
    rangedEnemy: chalk.hex('#ffb86b'),
    patrolEnemy: chalk.hex('#6bb8ff'),
    boss: chalk.bgHex('#3d0d14').hex('#ff4d5e').bold,
  },

  items: {
    weapon: chalk.hex('#e08aff'),
    armor: chalk.hex('#6fc3ff'),
    consumable: chalk.hex('#ffe66b'),
    item: chalk.hex('#ffe66b'),
  },

  hud: {
    label: chalk.hex('#7da8c3'),
    value: chalk.hex('#ecf2f8'),
    hpLow: chalk.hex('#ff4757').bold,
    hpMid: chalk.hex('#ffa502'),
    hpHigh: chalk.hex('#2ed573'),
    xp: chalk.hex('#4fd8d2'),
    xpEmpty: chalk.hex('#22343c'),
    barEmpty: chalk.hex('#26323a'),
    bossFloor: chalk.hex('#ff5d70').bold,
    panelBorder: chalk.hex('#3f6b75'),
    panelTitle: chalk.hex('#4fd8d2').bold,
    dim: chalk.hex('#5a6b78'),
  },

  messages: {
    combat: chalk.hex('#ffb86b'),
    info: chalk.hex('#d8e2ec'),
    xpGain: chalk.hex('#69ff8e'),
    levelUp: chalk.hex('#e08aff').bold,
    error: chalk.hex('#ff6b6b'),
    loot: chalk.hex('#e08aff'),
    perk: chalk.hex('#7aa2ff'),
    move: chalk.hex('#75858f'),
    heal: chalk.hex('#2ed573'),
    boss: chalk.hex('#ff4d5e').bold,
    warning: chalk.hex('#ffa502'),
    system: chalk.hex('#7da8c3'),
  },

  screens: {
    title: chalk.hex('#4fd8d2').bold,
    titleGlow: chalk.hex('#9beff0'),
    subtitle: chalk.hex('#5a7d8a'),
    gameOver: chalk.hex('#ff5d70').bold,
    gameOverLabel: chalk.hex('#7da8c3'),
    perkName: chalk.hex('#ffd76b').bold,
    perkDesc: chalk.hex('#8a98a3'),
    prompt: chalk.hex('#4fd8d2'),
    cursor: chalk.hex('#4fd8d2').bold,
    tutorialHeader: chalk.hex('#4fd8d2').bold,
    tutorialText: chalk.hex('#d8e2ec'),
    tutorialHighlight: chalk.hex('#ffd76b'),
    gold: chalk.hex('#ffd76b').bold,
    silver: chalk.hex('#c8d3dc'),
    bronze: chalk.hex('#d39b6a'),
  },
} as const;

// ─── Dynamic Colors ──────────────────────────────────────────────────────────

/** HP shifts smoothly through red → amber → green as health recovers. */
export function hpColor(current: number, max: number): ChalkInstance {
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
  const hex = ratio < 0.5
    ? lerpHex('#ff4757', '#ffa502', ratio * 2)
    : lerpHex('#ffa502', '#2ed573', (ratio - 0.5) * 2);
  return chalk.hex(hex);
}

export function xpColor(): ChalkInstance {
  return THEME.hud.xp;
}

export function borderColor(): ChalkInstance {
  return THEME.hud.panelBorder;
}

/** Color a banner with a vertical gradient, one hue per line. */
export function gradientLines(lines: string[], fromHex: string, toHex: string): string[] {
  const last = Math.max(1, lines.length - 1);
  return lines.map((line, i) => chalk.hex(lerpHex(fromHex, toHex, i / last)).bold(line));
}

export function colorizeMessage(msg: string): string {
  const lower = msg.toLowerCase();

  if (lower.includes('leveled up')) {
    return THEME.messages.levelUp(`${ICONS.levelUp} ${msg}`);
  }
  if (lower.includes('defeated') || lower.includes('damage') || lower.includes('attack') || lower.includes('hit') || lower.includes('slain')) {
    return THEME.messages.combat(`${ICONS.combat} ${msg}`);
  }
  if ((lower.includes('+') && lower.includes('xp')) || lower.includes('experience')) {
    return THEME.messages.xpGain(`${ICONS.info} ${msg}`);
  }
  if (lower.includes('picked up') || lower.includes('treasure') || lower.includes('found') || lower.includes('dropped')) {
    return THEME.messages.loot(`${ICONS.loot} ${msg}`);
  }
  if ((lower.includes('chose') && lower.includes('!')) || lower.includes('perk')) {
    return THEME.messages.perk(`${ICONS.perk} ${msg}`);
  }
  if (lower.includes('healed') || lower.includes('restored') || lower.includes('health')) {
    return THEME.messages.heal(`${ICONS.heal} ${msg}`);
  }
  if (lower.includes('blocked') || lower.includes('boss blocks') || lower.includes('no enemy') || lower.includes('nothing') || lower.includes('not found') || lower.includes('unknown command')) {
    return THEME.messages.warning(`${ICONS.warning} ${msg}`);
  }
  if (lower.includes('error') || lower.includes('invalid')) {
    return THEME.messages.error(`${ICONS.error} ${msg}`);
  }
  if (lower.includes('move') || lower.includes('descend') || lower.includes('look around')) {
    return THEME.messages.move(`${ICONS.move} ${msg}`);
  }
  if (lower.includes('welcome') || lower.includes('thanks for playing') || lower.includes('floor') && lower.includes('completed')) {
    return THEME.messages.system(`${ICONS.info} ${msg}`);
  }
  if (lower.includes('boss')) {
    return THEME.messages.boss(`${ICONS.boss} ${msg}`);
  }

  return THEME.messages.info(`${ICONS.info} ${msg}`);
}
