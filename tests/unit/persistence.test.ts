import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveRunRecord, loadRunHistory, getHighScores } from '../../src/systems/persistence.js';
import type { RunRecord } from '../../src/models/index.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deepshell-test-'));
}

function makeRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    date: new Date().toISOString(),
    floorsCleared: 3,
    enemiesDefeated: 10,
    bossesDefeated: 0,
    highestSkillLevels: { melee: 2, ranged: 1, defense: 1, stealth: 1, perception: 1 },
    seed: 'test-seed',
    ...overrides,
  };
}

describe('Persistence', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadRunHistory', () => {
    it('returns empty array when file does not exist', () => {
      expect(loadRunHistory(tmpDir)).toEqual([]);
    });

    it('returns records from a valid history file', () => {
      const record = makeRecord();
      const filePath = path.join(tmpDir, 'history.json');
      fs.writeFileSync(filePath, JSON.stringify([record]), 'utf-8');

      const result = loadRunHistory(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].seed).toBe('test-seed');
    });

    it('resets and returns empty array for corrupted JSON', () => {
      const filePath = path.join(tmpDir, 'history.json');
      fs.writeFileSync(filePath, '{not valid json!!!', 'utf-8');

      const result = loadRunHistory(tmpDir);
      expect(result).toEqual([]);

      // File should be reset to empty array
      const raw = fs.readFileSync(filePath, 'utf-8');
      expect(JSON.parse(raw)).toEqual([]);
    });

    it('resets and returns empty array when file contains non-array JSON', () => {
      const filePath = path.join(tmpDir, 'history.json');
      fs.writeFileSync(filePath, '{"not": "an array"}', 'utf-8');

      const result = loadRunHistory(tmpDir);
      expect(result).toEqual([]);

      const raw = fs.readFileSync(filePath, 'utf-8');
      expect(JSON.parse(raw)).toEqual([]);
    });
  });

  describe('saveRunRecord', () => {
    it('creates directory and file when they do not exist', () => {
      const nestedDir = path.join(tmpDir, 'nested', 'dir');
      const record = makeRecord();

      saveRunRecord(record, nestedDir);

      const result = loadRunHistory(nestedDir);
      expect(result).toHaveLength(1);
      expect(result[0].seed).toBe('test-seed');
    });

    it('appends to existing records', () => {
      saveRunRecord(makeRecord({ seed: 'first' }), tmpDir);
      saveRunRecord(makeRecord({ seed: 'second' }), tmpDir);

      const result = loadRunHistory(tmpDir);
      expect(result).toHaveLength(2);
      expect(result[0].seed).toBe('first');
      expect(result[1].seed).toBe('second');
    });

    it('handles write failure gracefully without throwing', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Pass a path that can't be written (file as directory)
      const badDir = path.join(tmpDir, 'history.json');
      fs.writeFileSync(badDir, 'block', 'utf-8');
      const deepBad = path.join(badDir, 'sub');

      // Should not throw
      expect(() => saveRunRecord(makeRecord(), deepBad)).not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('getHighScores', () => {
    it('returns empty array when no history exists', () => {
      expect(getHighScores(10, tmpDir)).toEqual([]);
    });

    it('returns records sorted by floorsCleared descending', () => {
      saveRunRecord(makeRecord({ floorsCleared: 5, seed: 'mid' }), tmpDir);
      saveRunRecord(makeRecord({ floorsCleared: 10, seed: 'best' }), tmpDir);
      saveRunRecord(makeRecord({ floorsCleared: 1, seed: 'worst' }), tmpDir);

      const scores = getHighScores(10, tmpDir);
      expect(scores).toHaveLength(3);
      expect(scores[0].floorsCleared).toBe(10);
      expect(scores[1].floorsCleared).toBe(5);
      expect(scores[2].floorsCleared).toBe(1);
    });

    it('limits results to the specified count', () => {
      for (let i = 0; i < 5; i++) {
        saveRunRecord(makeRecord({ floorsCleared: i }), tmpDir);
      }

      const scores = getHighScores(3, tmpDir);
      expect(scores).toHaveLength(3);
      expect(scores[0].floorsCleared).toBe(4);
    });
  });
});
