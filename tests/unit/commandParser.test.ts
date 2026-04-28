import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../src/systems/commandParser.js';

describe('parseCommand', () => {
  it('parses a simple action', () => {
    const result = parseCommand('look');
    expect(result).toEqual({ action: 'look', target: null, raw: 'look' });
  });

  it('parses action with target', () => {
    const result = parseCommand('equip iron sword');
    expect(result).toEqual({ action: 'equip', target: 'iron sword', raw: 'equip iron sword' });
  });

  it('is case-insensitive', () => {
    const result = parseCommand('LOOK');
    expect(result).toEqual({ action: 'look', target: null, raw: 'LOOK' });
  });

  it('trims whitespace', () => {
    const result = parseCommand('  look  ');
    expect(result).toEqual({ action: 'look', target: null, raw: '  look  ' });
  });

  it('handles extra internal whitespace', () => {
    const result = parseCommand('equip   iron sword');
    expect(result).toEqual({ action: 'equip', target: 'iron sword', raw: 'equip   iron sword' });
  });

  it('expands n abbreviation to north', () => {
    const result = parseCommand('n');
    expect(result).toEqual({ action: 'north', target: null, raw: 'n' });
  });

  it('expands s abbreviation to south', () => {
    const result = parseCommand('s');
    expect(result).toEqual({ action: 'south', target: null, raw: 's' });
  });

  it('expands e abbreviation to east', () => {
    const result = parseCommand('e');
    expect(result).toEqual({ action: 'east', target: null, raw: 'e' });
  });

  it('expands w abbreviation to west', () => {
    const result = parseCommand('w');
    expect(result).toEqual({ action: 'west', target: null, raw: 'w' });
  });

  it('returns CommandError for empty input', () => {
    const result = parseCommand('');
    expect('error' in result).toBe(true);
  });

  it('returns CommandError for whitespace-only input', () => {
    const result = parseCommand('   ');
    expect('error' in result).toBe(true);
  });

  it('returns CommandError for unrecognized command', () => {
    const result = parseCommand('dance');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('dance');
      expect(result.error).toContain('Available commands');
    }
  });

  it('preserves raw input in result', () => {
    const result = parseCommand('  LOOK  ');
    expect(result.raw).toBe('  LOOK  ');
  });

  it('parses all valid actions', () => {
    const actions = [
      'north', 'south', 'east', 'west', 'attack', 'inventory',
      'equip', 'use', 'look', 'inspect', 'skills', 'shoot',
      'drop', 'unequip', 'help', 'quit', 'pickup',
    ];
    for (const action of actions) {
      const result = parseCommand(action);
      expect('action' in result, `Expected "${action}" to be valid`).toBe(true);
    }
  });
});
