import chalk, { type ChalkInstance } from 'chalk';
import { ICONS } from './drawing.js';

export const THEME = {
  map: {
    wall: chalk.hex('#6c6c6c'),
    floor: chalk.hex('#4a4a4a'),
    corridor: chalk.hex('#4a4a4a'),
    door: chalk.hex('#d7af5f'),
    stairsUp: chalk.hex('#5fafd7'),
    stairsDown: chalk.hex('#d75fd7').bold,
  },

  entities: {
    player: chalk.hex('#5fd75f').bold,
    meleeEnemy: chalk.hex('#ff5f5f'),
    rangedEnemy: chalk.hex('#ffaf5f'),
    patrolEnemy: chalk.hex('#5fafff'),
    boss: chalk.hex('#ff0000').bold.bgHex('#1c1c1c'),
  },

  items: {
    weapon: chalk.hex('#d75fd7'),
    armor: chalk.hex('#5fafd7'),
    consumable: chalk.hex('#ffd700'),
    item: chalk.hex('#d7d700'),
  },

  hud: {
    label: chalk.hex('#87afd7'),
    value: chalk.hex('#e4e4e4'),
    hpLow: chalk.hex('#ff0000').bold,
    hpMid: chalk.hex('#ffaf00'),
    hpHigh: chalk.hex('#5fd75f'),
    xp: chalk.hex('#5fafd7'),
    xpEmpty: chalk.hex('#4a4a4a'),
    bossFloor: chalk.hex('#ff5f5f').bold,
    panelBorder: chalk.hex('#6c6c6c'),
    panelTitle: chalk.hex('#87afd7').bold,
  },

  messages: {
    combat: chalk.hex('#ffaf5f'),
    info: chalk.hex('#e4e4e4'),
    xpGain: chalk.hex('#5fd75f'),
    levelUp: chalk.hex('#d75fd7').bold,
    error: chalk.hex('#ff5f5f'),
    loot: chalk.hex('#d75fd7'),
    perk: chalk.hex('#5fafd7'),
    move: chalk.hex('#8a8a8a'),
    heal: chalk.hex('#5fd75f'),
    boss: chalk.hex('#ff0000').bold,
    warning: chalk.hex('#ffaf00'),
    system: chalk.hex('#87afd7'),
  },

  screens: {
    title: chalk.hex('#5fafd7').bold,
    titleGlow: chalk.hex('#87d7ff'),
    subtitle: chalk.hex('#8a8a8a'),
    gameOver: chalk.hex('#ff5f5f').bold,
    gameOverLabel: chalk.hex('#87afd7'),
    perkName: chalk.hex('#ffd700').bold,
    perkDesc: chalk.hex('#8a8a8a'),
    prompt: chalk.hex('#5fd75f'),
    cursor: chalk.hex('#5fd75f').bold,
    tutorialHeader: chalk.hex('#5fafd7').bold,
    tutorialText: chalk.hex('#e4e4e4'),
    tutorialHighlight: chalk.hex('#ffd700'),
  },
} as const;

export function hpColor(current: number, max: number): ChalkInstance {
  const ratio = current / max;
  if (ratio <= 0.25) return THEME.hud.hpLow;
  if (ratio <= 0.5) return THEME.hud.hpMid;
  return THEME.hud.hpHigh;
}

export function xpColor(): ChalkInstance {
  return THEME.hud.xp;
}

export function borderColor(): ChalkInstance {
  return THEME.hud.panelBorder;
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
