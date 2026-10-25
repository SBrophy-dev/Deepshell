import chalk, { type ChalkInstance } from 'chalk';

// ─── Constants ───────────────────────────────────────────────────────────────

export type BoxStyle = 'single' | 'round' | 'double' | 'heavy';

interface BoxChars {
  h: string;
  v: string;
  tl: string;
  tr: string;
  bl: string;
  br: string;
  capL: string;
  capR: string;
}

export const BOX_STYLES: Record<BoxStyle, BoxChars> = {
  single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘', capL: '┤', capR: '├' },
  round: { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯', capL: '┤', capR: '├' },
  double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝', capL: '╣', capR: '╠' },
  heavy: { h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛', capL: '┫', capR: '┣' },
} as const;

// Kept for backwards compatibility — the classic single-line set.
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
  arrow: '▸',
  diamond: '◆',
  diamondHollow: '◇',
  descend: '▼',
  ascend: '▲',
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
  style?: BoxStyle;
  titleAlign?: 'left' | 'center';
}

export function drawBox(lines: string[], options: BoxOptions): string[] {
  const {
    width,
    title,
    titleColor = chalk.gray,
    borderColor = chalk.gray,
    padding = 0,
    style = 'round',
    titleAlign = 'center',
  } = options;

  const chars = BOX_STYLES[style];
  const innerWidth = width - 2 - padding * 2;
  const result: string[] = [];

  // Top border — titles are seated into the frame with cap characters: ─┤ Title ├─
  let top = '';
  if (title) {
    const titlePlain = stripAnsi(title);
    const titleWidth = titlePlain.length + 2; // +2 for cap characters
    if (titleWidth + 2 <= width - 2) {
      const remaining = width - 2 - titleWidth;
      const left = titleAlign === 'left' ? Math.min(2, remaining) : Math.floor(remaining / 2);
      const right = remaining - left;
      top =
        borderColor(chars.tl + repeat(chars.h, left) + chars.capL) +
        titleColor(title) +
        borderColor(chars.capR + repeat(chars.h, right) + chars.tr);
    } else {
      top = borderColor(chars.tl + repeat(chars.h, width - 2) + chars.tr);
    }
  } else {
    top = borderColor(chars.tl + repeat(chars.h, width - 2) + chars.tr);
  }
  result.push(top);

  // Padding top
  for (let p = 0; p < padding; p++) {
    result.push(borderColor(chars.v) + repeat(' ', width - 2) + borderColor(chars.v));
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
    result.push(borderColor(chars.v) + repeat(' ', padding) + content + repeat(' ', padding) + borderColor(chars.v));
  }

  // Padding bottom
  for (let p = 0; p < padding; p++) {
    result.push(borderColor(chars.v) + repeat(' ', width - 2) + borderColor(chars.v));
  }

  // Bottom border
  const bottom = chars.bl + repeat(chars.h, width - 2) + chars.br;
  result.push(borderColor(bottom));

  return result;
}

export function drawCompactBox(lines: string[], width: number, borderColor = chalk.gray): string[] {
  const chars = BOX_STYLES.round;
  const result: string[] = [];
  result.push(borderColor(chars.tl + repeat(chars.h, width - 2) + chars.tr));
  for (const line of lines) {
    const innerWidth = width - 2;
    const plain = stripAnsi(line);
    const content = padRight(plain.length > innerWidth ? plain.slice(0, innerWidth) : plain, innerWidth);
    result.push(borderColor(chars.v) + content + borderColor(chars.v));
  }
  result.push(borderColor(chars.bl + repeat(chars.h, width - 2) + chars.br));
  return result;
}

// ─── Bars ────────────────────────────────────────────────────────────────────

// Sub-character resolution: each cell can be filled in eighths.
const BAR_FRACTIONS = ['▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;

function smoothFill(
  current: number,
  max: number,
  width: number,
  filledColor: ChalkInstance,
  emptyColor: ChalkInstance,
): string {
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
  const exact = width * ratio;
  let full = Math.floor(exact);
  const fracIdx = Math.round((exact - full) * 8);

  let partial = '';
  if (fracIdx >= 8) {
    full += 1;
  } else if (fracIdx > 0 && full < width) {
    partial = BAR_FRACTIONS[fracIdx - 1];
  }

  const empty = width - full - (partial ? 1 : 0);
  return (
    filledColor(repeat('█', full) + partial) +
    emptyColor(repeat('░', empty))
  );
}

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
  const bar = smoothFill(current, max, barWidth, filledColor, emptyColor);
  return `${labelColor(label)} [${bar}]${valueText}`;
}

export function drawMiniBar(
  current: number,
  max: number,
  width: number,
  filledColor: ChalkInstance,
  emptyColor: ChalkInstance,
): string {
  return smoothFill(current, max, width, filledColor, emptyColor);
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
