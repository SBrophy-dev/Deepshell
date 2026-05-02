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
      'drop', 'unequip', 'help', 'quit', 'pickup', 'messages', 'scroll',
    ];
    for (const action of actions) {
      const result = parseCommand(action);
      expect('action' in result, `Expected "${action}" to be valid`).toBe(true);
    }
  });

  describe('count parsing', () => {
    it('parses count for repeatable actions', () => {
      const result = parseCommand('north 5');
      expect(result).toEqual({ action: 'north', target: null, raw: 'north 5', count: 5 });
    });

    it('parses count with abbreviations', () => {
      const result = parseCommand('w 3');
      expect(result).toEqual({ action: 'west', target: null, raw: 'w 3', count: 3 });
    });

    it('parses count for attack', () => {
      const result = parseCommand('attack 4');
      expect(result).toEqual({ action: 'attack', target: null, raw: 'attack 4', count: 4 });
    });

    it('caps count at 50', () => {
      const result = parseCommand('north 100');
      expect('count' in result && result.count).toBe(50);
    });

    it('sets minimum count to 1', () => {
      const result = parseCommand('north 0');
      expect('count' in result && result.count).toBe(1);
    });

    it('does not parse count for non-repeatable actions', () => {
      const result = parseCommand('inventory 5');
      expect(result).toEqual({ action: 'inventory', target: '5', raw: 'inventory 5' });
    });

    it('parses shoot with direction (no count)', () => {
      const result = parseCommand('shoot north 5');
      expect(result).toEqual({ action: 'shoot', target: 'north 5', raw: 'shoot north 5' });
    });
  });
});
