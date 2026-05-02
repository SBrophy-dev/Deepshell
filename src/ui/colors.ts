import chalk, { type ChalkInstance } from 'chalk';

export const THEME = {
  map: {
    wall: chalk.gray,
    floor: chalk.dim.gray,
    corridor: chalk.dim.gray,
    door: chalk.yellow,
    stairsUp: chalk.cyan,
    stairsDown: chalk.magenta.bold,
  },

  entities: {
    player: chalk.bold.green,
    meleeEnemy: chalk.red,
    rangedEnemy: chalk.yellow,
    patrolEnemy: chalk.blue,
    boss: chalk.bold.red.bgBlack,
  },

  items: {
    weapon: chalk.magenta,
    armor: chalk.cyan,
    item: chalk.yellow,
  },

  hud: {
    label: chalk.cyan,
    value: chalk.white,
    hpLow: chalk.red.bold,
    hpMid: chalk.yellow,
    hpHigh: chalk.green,
    bossFloor: chalk.bold.red,
  },

  messages: {
    combat: chalk.yellow,
    info: chalk.white,
    xpGain: chalk.green,
    levelUp: chalk.bold.magenta,
    error: chalk.red,
    loot: chalk.magenta,
    perk: chalk.cyan,
  },

  screens: {
    title: chalk.bold.cyan,
    gameOver: chalk.bold.red,
    gameOverLabel: chalk.cyan,
    perkName: chalk.bold.yellow,
    perkDesc: chalk.gray,
  },
} as const;

export function hpColor(current: number, max: number): ChalkInstance {
  const ratio = current / max;
  if (ratio <= 0.25) return THEME.hud.hpLow;
  if (ratio <= 0.5) return THEME.hud.hpMid;
  return THEME.hud.hpHigh;
}

export function colorizeMessage(msg: string): string {
  if (msg.includes('leveled up')) return THEME.messages.levelUp(msg);
  if (msg.includes('defeated') || msg.includes('damage') || msg.includes('attack')) {
    return THEME.messages.combat(msg);
  }
  if (msg.includes('+') && msg.includes('XP')) return THEME.messages.xpGain(msg);
  if (msg.includes('Picked up') || msg.includes('treasure')) return THEME.messages.loot(msg);
  if (msg.includes('chose') && msg.includes('!')) return THEME.messages.perk(msg);
  return THEME.messages.info(msg);
}
