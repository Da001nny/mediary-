import {
  WorkoutSet,
  isCountableSet,
  calculateSetVolume,
  calculateSetOneRepMax,
} from "./calculations";

/**
 * Escapes a cell value for CSV export, guarding against formula injection.
 * Only values whose typeof is 'number' skip the formula guard.
 * Every string cell that starts with = + - @ TAB (\t) or CR (\r) gets the leading apostrophe ('),
 * even if it looks numeric (e.g. "-1", "+1", "1e3" are strings and must be guarded when they
 * start with one of those characters).
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Only values whose typeof is 'number' skip the formula guard
  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return "";
    }
    return String(value);
  }

  let str = String(value);

  // Every string cell that starts with = + - @ TAB or CR gets the leading apostrophe
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Standard CSV escaping: wrap in double quotes if it contains commas, quotes, or newlines
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface WorkoutExportItem {
  id?: string;
  name?: string;
  date?: string;
  notes?: string;
  sets?: (WorkoutSet & { exercise_name?: string; order?: number })[];
  [key: string]: unknown;
}

/**
 * Exports workouts and their constituent sets to CSV format.
 * Employs isCountableSet for calculating the CSV 1RM column and Volume column,
 * and escapeCsvCell for formula-injection-safe CSV formatting.
 */
export function exportWorkoutsToCsv(workouts: WorkoutExportItem[]): string {
  const headers = [
    "Date",
    "Workout Name",
    "Exercise",
    "Set Order",
    "Weight",
    "Reps",
    "Completed",
    "Warmup",
    "Volume",
    "1RM",
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const workout of workouts) {
    const workoutName = workout.name ?? "Untitled Workout";
    const date = workout.date ?? "";

    if (!workout.sets || workout.sets.length === 0) {
      const row = [
        escapeCsvCell(date),
        escapeCsvCell(workoutName),
        escapeCsvCell(""),
        escapeCsvCell(""),
        escapeCsvCell(""),
        escapeCsvCell(""),
        escapeCsvCell(""),
        escapeCsvCell(""),
        escapeCsvCell(0),
        escapeCsvCell(""),
      ];
      rows.push(row.join(","));
      continue;
    }

    workout.sets.forEach((set, index) => {
      const exercise = set.exercise_name ?? "";
      const setOrder = set.order ?? index + 1;
      const weight = set.weight ?? "";
      const reps = set.reps ?? "";
      const completed = set.completed ? "true" : "false";
      const isWarmup = Boolean(set.warmup || set.is_warmup || set.type === "warmup");
      const warmup = isWarmup ? "true" : "false";

      // Volume column: calculated via isCountableSet
      const volume = isCountableSet(set) ? calculateSetVolume(set) : 0;

      // 1RM column: calculated via isCountableSet; only populated for countable sets
      const oneRepMax = isCountableSet(set) ? calculateSetOneRepMax(set) : "";

      const row = [
        escapeCsvCell(date),
        escapeCsvCell(workoutName),
        escapeCsvCell(exercise),
        escapeCsvCell(setOrder),
        escapeCsvCell(weight),
        escapeCsvCell(reps),
        escapeCsvCell(completed),
        escapeCsvCell(warmup),
        escapeCsvCell(volume),
        escapeCsvCell(oneRepMax),
      ];

      rows.push(row.join(","));
    });
  }

  return rows.join("\n");
}
