import type { PlayerSkills, SkillType } from '../models/index.js';

/**
 * Returns the XP threshold needed to reach the given level.
 * Thresholds are monotonically increasing: each subsequent level requires more XP.
 * Level 1 requires 0 XP (starting level), level 2 requires 100 XP, etc.
 */
export function getThreshold(level: number): number {
  if (level <= 1) return 0;
  // Quadratic scaling: 100 * (level - 1)^2
  return 100 * (level - 1) * (level - 1);
}

/** Bonus rates per skill type (per level) */
const BONUS_RATES: Record<SkillType, number> = {
  melee: 0.05,
  ranged: 0.05,
  defense: 0.03,
  stealth: 0.04,
  perception: 0.04,
};

/**
 * Returns the scaling bonus for a skill based on its current level.
 * Returned as a decimal multiplier (e.g., level 3 melee = 0.15).
 */
export function getBonus(skills: PlayerSkills, skill: SkillType): number {
  const level = skills[skill].level;
  return level * BONUS_RATES[skill];
}

/**
 * Awards XP to a specific skill. If XP reaches the threshold for the next level,
 * increases the skill's level by one and returns the skill type that leveled up.
 */
export function awardXp(
  skills: PlayerSkills,
  skill: SkillType,
  amount: number,
): { skills: PlayerSkills; leveledUp: SkillType | null } {
  const current = skills[skill];
  const newXp = current.xp + amount;
  const nextLevelThreshold = getThreshold(current.level + 1);

  if (newXp >= nextLevelThreshold) {
    return {
      skills: {
        ...skills,
        [skill]: { level: current.level + 1, xp: newXp },
      },
      leveledUp: skill,
    };
  }

  return {
    skills: {
      ...skills,
      [skill]: { level: current.level, xp: newXp },
    },
    leveledUp: null,
  };
}
