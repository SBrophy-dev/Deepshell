import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RunRecord } from '../models/index.js';

const DEFAULT_DIR = path.join(os.homedir(), '.deepshell');
const HISTORY_FILE = 'history.json';

function getHistoryPath(dir?: string): string {
  return path.join(dir ?? DEFAULT_DIR, HISTORY_FILE);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadRunHistory(dir?: string): RunRecord[] {
  const filePath = getHistoryPath(dir);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      fs.writeFileSync(filePath, '[]', 'utf-8');
      return [];
    }
    return parsed as RunRecord[];
  } catch {
    // Corrupted JSON — reset to empty
    try {
      ensureDir(dir ?? DEFAULT_DIR);
      fs.writeFileSync(filePath, '[]', 'utf-8');
    } catch {
      // If we can't even write, just return empty
    }
    return [];
  }
}

export function saveRunRecord(record: RunRecord, dir?: string): void {
  try {
    const targetDir = dir ?? DEFAULT_DIR;
    ensureDir(targetDir);
    const records = loadRunHistory(dir);
    records.push(record);
    fs.writeFileSync(getHistoryPath(dir), JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save run record:', err);
  }
}

export function getHighScores(limit: number, dir?: string): RunRecord[] {
  const records = loadRunHistory(dir);
  return records
    .sort((a, b) => b.floorsCleared - a.floorsCleared)
    .slice(0, limit);
}
