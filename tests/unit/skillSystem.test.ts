import { describe, it, expect } from 'vitest';
import { awardXp, getBonus, getThreshold } from '../../src/systems/skillSystem.js';
import type { PlayerSkills } from '../../src/models/index.js';

function makeDefaultSkills(): PlayerSkills {
  const base = () => ({ level: 1, xp: 0 });
  return {
    melee: base(),
    ranged: base(),
    defense: base(),
    stealth: base(),
    perception: base(),
  };
}

describe('getThreshold', () => {
  it('returns 0 for level 1', () => {
    expect(getThreshold(1)).toBe(0);
  });

  it('returns 100 for level 2', () => {
    expect(getThreshold(2)).toBe(100);
  });

  it('returns monotonically increasing values', () => {
    for (let i = 2; i <= 20; i++) {
      expect(getThreshold(i)).toBeGreaterThan(getThreshold(i - 1));
    }
  });
});

describe('getBonus', () => {
  it('returns 0.05 per level for melee', () => {
    const skills = makeDefaultSkills();
    skills.melee.level = 3;
    expect(getBonus(skills, 'melee')).toBeCloseTo(0.15);
  });

  it('returns 0.05 per level for ranged', () => {
    const skills = makeDefaultSkills();
    skills.ranged.level = 2;
    expect(getBonus(skills, 'ranged')).toBeCloseTo(0.10);
  });

  it('returns 0.03 per level for defense', () => {
    const skills = makeDefaultSkills();
    skills.defense.level = 4;
    expect(getBonus(skills, 'defense')).toBeCloseTo(0.12);
  });

  it('returns 0.04 per level for stealth', () => {
    const skills = makeDefaultSkills();
    skills.stealth.level = 5;
    expect(getBonus(skills, 'stealth')).toBeCloseTo(0.20);
  });

  it('returns 0.04 per level for perception', () => {
    const skills = makeDefaultSkills();
    skills.perception.level = 3;
    expect(getBonus(skills, 'perception')).toBeCloseTo(0.12);
  });
});

describe('awardXp', () => {
  it('adds XP without leveling up when below threshold', () => {
    const skills = makeDefaultSkills();
    const result = awardXp(skills, 'melee', 50);
    expect(result.skills.melee.xp).toBe(50);
    expect(result.skills.melee.level).toBe(1);
    expect(result.leveledUp).toBeNull();
  });

  it('levels up when XP reaches the next threshold', () => {
    const skills = makeDefaultSkills();
    const result = awardXp(skills, 'melee', 100);
    expect(result.skills.melee.level).toBe(2);
    expect(result.skills.melee.xp).toBe(100);
    expect(result.leveledUp).toBe('melee');
  });

  it('levels up when XP exceeds the next threshold', () => {
    const skills = makeDefaultSkills();
    const result = awardXp(skills, 'ranged', 150);
    expect(result.skills.ranged.level).toBe(2);
    expect(result.skills.ranged.xp).toBe(150);
    expect(result.leveledUp).toBe('ranged');
  });

  it('does not modify other skills', () => {
    const skills = makeDefaultSkills();
    const result = awardXp(skills, 'defense', 50);
    expect(result.skills.melee).toEqual({ level: 1, xp: 0 });
    expect(result.skills.ranged).toEqual({ level: 1, xp: 0 });
    expect(result.skills.stealth).toEqual({ level: 1, xp: 0 });
    expect(result.skills.perception).toEqual({ level: 1, xp: 0 });
  });

  it('handles cumulative XP across multiple awards', () => {
    const skills = makeDefaultSkills();
    const r1 = awardXp(skills, 'stealth', 60);
    expect(r1.leveledUp).toBeNull();
    const r2 = awardXp(r1.skills, 'stealth', 50);
    expect(r2.skills.stealth.level).toBe(2);
    expect(r2.skills.stealth.xp).toBe(110);
    expect(r2.leveledUp).toBe('stealth');
  });
});
