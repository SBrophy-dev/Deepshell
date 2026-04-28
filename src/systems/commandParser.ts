import type { ParsedCommand, CommandError } from '../models/index.js';

const ABBREVIATIONS: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
};

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
]);

export function parseCommand(input: string): ParsedCommand | CommandError {
  const raw = input;
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      error: `Unknown command. Available commands: ${[...VALID_ACTIONS].join(', ')}`,
      raw,
    };
  }

  const parts = trimmed.split(/\s+/);
  let action = parts[0].toLowerCase();
  const target = parts.length > 1 ? parts.slice(1).join(' ') : null;

  // Expand abbreviations
  if (action in ABBREVIATIONS) {
    action = ABBREVIATIONS[action];
  }

  if (!VALID_ACTIONS.has(action)) {
    return {
      error: `Unknown command "${action}". Available commands: ${[...VALID_ACTIONS].join(', ')}`,
      raw,
    };
  }

  return { action, target, raw };
}
