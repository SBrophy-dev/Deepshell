import type { ParsedCommand, CommandError } from '../models/index.js';

const ABBREVIATIONS: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
};

const REPEATABLE_ACTIONS = new Set([
  'north',
  'south',
  'east',
  'west',
  'attack',
]);

const VALID_ACTIONS = new Set([
  'north',
  'south',
  'east',
  'west',
  'attack',
  'inventory',
  'equip',
  'use',
  'look',
  'inspect',
  'skills',
  'shoot',
  'drop',
  'unequip',
  'help',
  'quit',
  'pickup',
  'messages',
  'scroll',
]);

export function parseCommand(input: string): ParsedCommand | CommandError {
  const raw = input;
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      error: `Unknown command. Type "help" for available commands.`,
      raw,
    };
  }

  const parts = trimmed.split(/\s+/);
  let action = parts[0].toLowerCase();

  if (action in ABBREVIATIONS) {
    action = ABBREVIATIONS[action];
  }

  if (!VALID_ACTIONS.has(action)) {
    return {
      error: `Unknown command "${action}". Type "help" for available commands.`,
      raw,
    };
  }

  let target: string | null = null;
  let count: number | undefined = undefined;

  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const countMatch = lastPart.match(/^(\d+)$/);

    if (countMatch && REPEATABLE_ACTIONS.has(action)) {
      count = parseInt(countMatch[1], 10);
      if (count < 1) count = 1;
      if (count > 50) count = 50;
      if (parts.length > 2) {
        target = parts.slice(1, -1).join(' ');
      }
    } else {
      target = parts.slice(1).join(' ');
    }
  }

  return { action, target, raw, count };
}
