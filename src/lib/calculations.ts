/**
 * Core calculation helpers for workout sets, volume, 1RM, and PR tracking.
 */

export interface WorkoutSet {
  id?: string;
  completed?: boolean;
  warmup?: boolean;
  is_warmup?: boolean;
  type?: string; // 'normal' | 'warmup' | 'drop' | 'failure'
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  [key: string]: unknown;
}

/**
 * Checks whether a set qualifies as a countable set for volume, 1RM, and PR calculations.
 * Criteria:
 *   1. completed === true
 *   2. not a warmup set (warmup, is_warmup, or type === 'warmup')
 *   3. weight > 0
 *   4. reps > 0
 */
export function isCountableSet(set: WorkoutSet | null | undefined): boolean {
  if (!set) return false;

  const isCompleted = Boolean(set.completed);
  const isWarmup = Boolean(set.warmup || set.is_warmup || set.type === "warmup");
  const weight = typeof set.weight === "number" ? set.weight : Number(set.weight);
  const reps = typeof set.reps === "number" ? set.reps : Number(set.reps);

  return isCompleted && !isWarmup && !Number.isNaN(weight) && weight > 0 && !Number.isNaN(reps) && reps > 0;
}

/**
 * Calculates volume (weight * reps) for an individual set.
 * Uses isCountableSet — returns 0 if the set is not countable.
 */
export function calculateSetVolume(set: WorkoutSet | null | undefined): number {
  if (!isCountableSet(set)) {
    return 0;
  }
  return Number(set!.weight) * Number(set!.reps);
}

/**
 * Calculates estimated 1RM for an individual set using Epley's formula: weight * (1 + reps / 30).
 * Uses isCountableSet — returns 0 if the set is not countable.
 */
export function calculateSetOneRepMax(set: WorkoutSet | null | undefined): number {
  if (!isCountableSet(set)) {
    return 0;
  }
  const weight = Number(set!.weight);
  const reps = Number(set!.reps);
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 100) / 100;
}

/**
 * Calculates total volume across a collection of sets.
 * Uses isCountableSet to filter valid sets.
 */
export function calculateTotalVolume(sets: (WorkoutSet | null | undefined)[]): number {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce<number>((total, set) => {
    if (!isCountableSet(set)) return total;
    return total + (Number(set!.weight) * Number(set!.reps));
  }, 0);
}

/**
 * Calculates total volume for a workout object.
 * Uses isCountableSet indirectly via calculateTotalVolume.
 */
export function calculateWorkoutVolume(workout: { sets?: (WorkoutSet | null | undefined)[] } | null | undefined): number {
  if (!workout?.sets) return 0;
  return calculateTotalVolume(workout.sets);
}

/**
 * Finds the highest 1RM among all countable sets.
 * Uses isCountableSet to filter valid sets.
 */
export function calculateBest1RM(sets: (WorkoutSet | null | undefined)[]): number {
  if (!Array.isArray(sets)) return 0;
  let max1RM = 0;
  for (const set of sets) {
    if (isCountableSet(set)) {
      const oneRepMax = calculateSetOneRepMax(set);
      if (oneRepMax > max1RM) {
        max1RM = oneRepMax;
      }
    }
  }
  return max1RM;
}

/**
 * Determines if a set achieves a new personal record (PR) by surpassing a historical 1RM.
 * Uses isCountableSet — non-countable sets can never be PRs.
 */
export function isPersonalRecord(
  set: WorkoutSet | null | undefined,
  historicalBest1RM: number
): boolean {
  if (!isCountableSet(set)) {
    return false;
  }
  return calculateSetOneRepMax(set) > historicalBest1RM;
}

/**
 * Finds the maximum weight lifted across countable sets.
 * Uses isCountableSet to filter valid sets.
 */
export function calculateExerciseMaxWeight(sets: (WorkoutSet | null | undefined)[]): number {
  if (!Array.isArray(sets)) return 0;
  let maxWeight = 0;
  for (const set of sets) {
    if (isCountableSet(set)) {
      const w = Number(set!.weight);
      if (w > maxWeight) maxWeight = w;
    }
  }
  return maxWeight;
}

export { escapeCsvCell } from "./csv";
