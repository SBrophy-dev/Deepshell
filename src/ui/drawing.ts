import chalk, { type ChalkInstance } from 'chalk';

// ─── Constants ───────────────────────────────────────────────────────────────

export const BOX = {
  h: '─',
  v: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  ml: '├',
  mr: '┤',
  tm: '┬',
  bm: '┴',
  mm: '┼',
} as const;

export const ICONS = {
  combat: '⚔',
  loot: '✦',
  levelUp: '▲',
  error: '✖',
  info: 'ℹ',
  move: '➤',
  heal: '✚',
  perk: '★',
  boss: '☠',
  warning: '⚠',
  arrow: '►',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function repeat(char: string, count: number): string {
  return char.repeat(Math.max(0, count));
}

export function padLeft(text: string, width: number): string {
  const len = stripAnsi(text).length;
  if (len >= width) return text;
  return repeat(' ', width - len) + text;
}

export function padRight(text: string, width: number): string {
  const len = stripAnsi(text).length;
  if (len >= width) return text;
  return text + repeat(' ', width - len);
}

export function padCenter(text: string, width: number): string {
  const len = stripAnsi(text).length;
  if (len >= width) return text;
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return repeat(' ', left) + text + repeat(' ', right);
}

export function truncateAnsi(text: string, width: number): string {
  const plain = stripAnsi(text);
  if (plain.length <= width) return text;

  let count = 0;
  let result = '';
  let inEscape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\x1b') {
      inEscape = true;
      result += char;
      continue;
    }
    if (inEscape) {
      result += char;
      if (char === 'm') inEscape = false;
      continue;
    }
    if (count >= width) break;
    result += char;
    count++;
  }

  return result;
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (stripAnsi(current + ' ' + word).length > width && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current.length > 0 ? current + ' ' + word : word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

export interface BoxOptions {
  width: number;
  title?: string;
  titleColor?: ChalkInstance;
  borderColor?: ChalkInstance;
  padding?: number;
}

export function drawBox(lines: string[], options: BoxOptions): string[] {
  const {
    width,
    title,
    titleColor = chalk.gray,
    borderColor = chalk.gray,
    padding = 0,
  } = options;

  const innerWidth = width - 2 - padding * 2;
  const result: string[] = [];

  // Top border
  let top = '';
  if (title) {
    const titlePlain = stripAnsi(title);
    const titleWidth = titlePlain.length;
    if (titleWidth + 4 <= width - 2) {
      const left = Math.floor((width - 2 - titleWidth - 2) / 2);
      const right = width - 2 - titleWidth - 2 - left;
      top =
        borderColor(BOX.tl + repeat(BOX.h, left)) +
        ' ' +
        titleColor(title) +
        ' ' +
        borderColor(repeat(BOX.h, right) + BOX.tr);
    } else {
      top = borderColor(BOX.tl + repeat(BOX.h, width - 2) + BOX.tr);
    }
  } else {
    top = borderColor(BOX.tl + repeat(BOX.h, width - 2) + BOX.tr);
  }
  result.push(top);

  // Padding top
  for (let p = 0; p < padding; p++) {
    result.push(borderColor(BOX.v) + repeat(' ', width - 2) + borderColor(BOX.v));
  }

  // Content (preserve ANSI codes)
  for (const line of lines) {
    const plain = stripAnsi(line);
    let content: string;
    if (plain.length > innerWidth) {
      content = truncateAnsi(line, innerWidth);
    } else {
      content = line + repeat(' ', innerWidth - plain.length);
    }
    result.push(borderColor(BOX.v) + repeat(' ', padding) + content + repeat(' ', padding) + borderColor(BOX.v));
  }

  // Padding bottom
  for (let p = 0; p < padding; p++) {
    result.push(borderColor(BOX.v) + repeat(' ', width - 2) + borderColor(BOX.v));
  }

  // Bottom border
  const bottom = BOX.bl + repeat(BOX.h, width - 2) + BOX.br;
  result.push(borderColor(bottom));

  return result;
}

export function drawCompactBox(lines: string[], width: number, borderColor = chalk.gray): string[] {
  const result: string[] = [];
  result.push(borderColor(BOX.tl + repeat(BOX.h, width - 2) + BOX.tr));
  for (const line of lines) {
    const innerWidth = width - 2;
    const plain = stripAnsi(line);
    const content = padRight(plain.length > innerWidth ? plain.slice(0, innerWidth) : plain, innerWidth);
    result.push(borderColor(BOX.v) + content + borderColor(BOX.v));
  }
  result.push(borderColor(BOX.bl + repeat(BOX.h, width - 2) + BOX.br));
  return result;
}

// ─── Bars ────────────────────────────────────────────────────────────────────

export function drawBar(
  label: string,
  current: number,
  max: number,
  width: number,
  filledColor: ChalkInstance,
  emptyColor: ChalkInstance,
  labelColor: ChalkInstance = chalk.gray,
): string {
  const plainLabel = stripAnsi(label);
  const valueText = ` ${current}/${max}`;
  const barWidth = Math.max(4, width - plainLabel.length - valueText.length - 3); // 3 for brackets and space
  const ratio = max > 0 ? current / max : 0;
  const filledCount = Math.round(barWidth * ratio);
  const emptyCount = barWidth - filledCount;

  const bar =
    filledColor(repeat('█', filledCount)) + emptyColor(repeat('░', emptyCount));

  return `${labelColor(label)} [${bar}]${valueText}`;
}

export function drawMiniBar(
  current: number,
  max: number,
  width: number,
  filledColor: ChalkInstance,
  emptyColor: ChalkInstance,
): string {
  const ratio = max > 0 ? current / max : 0;
  const filledCount = Math.round(width * ratio);
  const emptyCount = width - filledCount;
  return filledColor(repeat('█', filledCount)) + emptyColor(repeat('░', emptyCount));
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function stackPanels(panels: string[][]): string[] {
  const result: string[] = [];
  for (const panel of panels) {
    result.push(...panel);
  }
  return result;
}

export function joinPanelsHorizontally(leftPanel: string[], rightPanel: string[]): string[] {
  const maxLines = Math.max(leftPanel.length, rightPanel.length);
  const result: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    const left = leftPanel[i] ?? '';
    const right = rightPanel[i] ?? '';
    const gap = left ? ' ' : '';
    result.push(left + gap + right);
  }
  return result;
}
