/**
 * Gamification System
 * Handles XP, levels, and progression calculations
 */

// XP Rewards for different actions
export const XP_REWARDS = {
  STEP_COMPLETE: 20,
  QUIZ_PASS: 40,
  QUIZ_PERFECT: 60, // All questions correct
  ROADMAP_COMPLETE: 100,
  DAILY_STREAK: 25,
} as const;

// Level thresholds - Easy progression till level 10, then gradually harder
// Formula: 
// - Levels 1-10: 100 XP per level (easy)
// - Levels 11-20: 200 XP per level
// - Levels 21-30: 400 XP per level
// - Levels 31-40: 800 XP per level
// - Levels 41-50: 1600 XP per level
export function calculateLevelThresholds(): number[] {
  const thresholds: number[] = [0]; // Level 1 starts at 0 XP
  
  for (let level = 1; level <= 50; level++) {
    let xpForLevel: number;
    
    if (level <= 10) {
      xpForLevel = 100;
    } else if (level <= 20) {
      xpForLevel = 200;
    } else if (level <= 30) {
      xpForLevel = 400;
    } else if (level <= 40) {
      xpForLevel = 800;
    } else {
      xpForLevel = 1600;
    }
    
    const nextThreshold = thresholds[thresholds.length - 1] + xpForLevel;
    thresholds.push(nextThreshold);
  }
  
  return thresholds;
}

// Cache the thresholds
export const LEVEL_THRESHOLDS = calculateLevelThresholds();

/**
 * Calculate level from total XP
 */
export function calculateLevel(xp: number): number {
  if (xp < 0) return 1;
  
  // LEVEL_THRESHOLDS[i] represents XP needed to reach level i+1
  // So if xp >= LEVEL_THRESHOLDS[9] (900), player is at level 10
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return Math.min(i + 1, 50); // Return level (index + 1), cap at level 50
    }
  }
  
  return 1;
}

/**
 * Get XP required for next level
 */
export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel >= 50) return 0; // Max level
  return LEVEL_THRESHOLDS[currentLevel];
}

/**
 * Get XP required for current level
 */
export function getXPForCurrentLevel(currentLevel: number): number {
  if (currentLevel <= 1) return 0;
  return LEVEL_THRESHOLDS[currentLevel - 1];
}

/**
 * Calculate progress percentage towards next level
 */
export function calculateLevelProgress(xp: number, currentLevel: number): number {
  if (currentLevel >= 50) return 100; // Max level
  
  const currentLevelXP = getXPForCurrentLevel(currentLevel);
  const nextLevelXP = getXPForNextLevel(currentLevel);
  const xpInCurrentLevel = xp - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  if (xpNeededForLevel === 0) return 100;
  
  return Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForLevel) * 100));
}

/**
 * Check if user leveled up after gaining XP
 */
export function checkLevelUp(oldXP: number, newXP: number): {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
} {
  const oldLevel = calculateLevel(oldXP);
  const newLevel = calculateLevel(newXP);
  
  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
  };
}

/**
 * Get level title/rank based on level
 */
export function getLevelTitle(level: number): string {
  if (level <= 5) return 'Beginner';
  if (level <= 10) return 'Learner';
  if (level <= 15) return 'Apprentice';
  if (level <= 20) return 'Student';
  if (level <= 25) return 'Scholar';
  if (level <= 30) return 'Expert';
  if (level <= 35) return 'Master';
  if (level <= 40) return 'Sage';
  if (level <= 45) return 'Guru';
  return 'Legend';
}

/**
 * Format XP with commas
 */
export function formatXP(xp: number): string {
  return xp.toLocaleString();
}
