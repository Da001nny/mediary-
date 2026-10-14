import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  escapeCsvCell,
  exportWorkoutsToCsv,
} from "../src/lib/csv";
import {
  isCountableSet,
  calculateSetVolume,
  calculateSetOneRepMax,
  calculateTotalVolume,
  calculateWorkoutVolume,
  calculateBest1RM,
  isPersonalRecord,
  calculateExerciseMaxWeight,
  WorkoutSet,
} from "../src/lib/calculations";

describe("escapeCsvCell - formula guard and numeric handling", () => {
  test('escapeCsvCell("-1") prepends apostrophe', () => {
    assert.equal(escapeCsvCell("-1"), "'-1");
  });

  test('escapeCsvCell("+1") prepends apostrophe', () => {
    assert.equal(escapeCsvCell("+1"), "'+1");
  });

  test('escapeCsvCell("=1+1") prepends apostrophe', () => {
    assert.equal(escapeCsvCell("=1+1"), "'=1+1");
  });

  test('escapeCsvCell("@x") prepends apostrophe', () => {
    assert.equal(escapeCsvCell("@x"), "'@x");
  });

  test('escapeCsvCell("normal") remains unescaped', () => {
    assert.equal(escapeCsvCell("normal"), "normal");
  });

  test("escapeCsvCell(-1) number stays -1 without leading apostrophe", () => {
    assert.equal(escapeCsvCell(-1), "-1");
  });

  test('escapeCsvCell with TAB (\t) and CR (\r)', () => {
    assert.equal(escapeCsvCell("\tsomeValue"), "'\tsomeValue");
    const crResult = escapeCsvCell("\rsomeValue");
    assert.match(crResult, /'/);
  });

  test('numeric-looking strings without leading formula chars are not prepended', () => {
    assert.equal(escapeCsvCell("1e3"), "1e3");
    assert.equal(escapeCsvCell("100"), "100");
  });

  test('numeric-looking strings with leading minus/plus are guarded', () => {
    assert.equal(escapeCsvCell("-1e3"), "'-1e3");
    assert.equal(escapeCsvCell("+1e3"), "'+1e3");
  });

  test("null and undefined return empty string", () => {
    assert.equal(escapeCsvCell(null), "");
    assert.equal(escapeCsvCell(undefined), "");
  });
});

describe("CSV Export - Formula Guarding", () => {
  test('workout named "=SUM(A1)" outputs a cell starting with an apostrophe', () => {
    const workouts = [
      {
        name: "=SUM(A1)",
        date: "2026-10-14",
        sets: [
          {
            exercise_name: "Bench Press",
            weight: 100,
            reps: 5,
            completed: true,
            warmup: false,
          },
        ],
      },
    ];

    const csvOutput = exportWorkoutsToCsv(workouts);
    const lines = csvOutput.trim().split("\n");
    assert.ok(lines.length >= 2, "CSV should contain header and at least one row");

    // Line 1 is the set row: Date, Workout Name, Exercise, ...
    const rowValues = lines[1].split(",");
    const workoutNameCell = rowValues[1];

    assert.ok(
      workoutNameCell.startsWith("'"),
      `Expected workout name cell to start with apostrophe, got: ${workoutNameCell}`
    );
    assert.equal(workoutNameCell, "'=SUM(A1)");
  });
});

describe("isCountableSet - validation rules", () => {
  test("returns true for completed, non-warmup set with positive weight and reps", () => {
    const set: WorkoutSet = {
      completed: true,
      warmup: false,
      weight: 100,
      reps: 5,
    };
    assert.equal(isCountableSet(set), true);
  });

  test("returns false when completed is false or undefined", () => {
    assert.equal(
      isCountableSet({ completed: false, warmup: false, weight: 100, reps: 5 }),
      false
    );
    assert.equal(
      isCountableSet({ warmup: false, weight: 100, reps: 5 }),
      false
    );
  });

  test("returns false for warmup sets (warmup: true, is_warmup: true, type: 'warmup')", () => {
    assert.equal(
      isCountableSet({ completed: true, warmup: true, weight: 100, reps: 5 }),
      false
    );
    assert.equal(
      isCountableSet({ completed: true, is_warmup: true, weight: 100, reps: 5 }),
      false
    );
    assert.equal(
      isCountableSet({ completed: true, type: "warmup", weight: 100, reps: 5 }),
      false
    );
  });

  test("returns false when weight <= 0", () => {
    assert.equal(
      isCountableSet({ completed: true, warmup: false, weight: 0, reps: 5 }),
      false
    );
    assert.equal(
      isCountableSet({ completed: true, warmup: false, weight: -50, reps: 5 }),
      false
    );
  });

  test("returns false when reps <= 0", () => {
    assert.equal(
      isCountableSet({ completed: true, warmup: false, weight: 100, reps: 0 }),
      false
    );
    assert.equal(
      isCountableSet({ completed: true, warmup: false, weight: 100, reps: -2 }),
      false
    );
  });

  test("returns false for null or undefined input", () => {
    assert.equal(isCountableSet(null), false);
    assert.equal(isCountableSet(undefined), false);
  });
});

describe("Calculations using isCountableSet", () => {
  test("calculateSetVolume returns weight * reps for countable set, 0 otherwise", () => {
    const validSet: WorkoutSet = { completed: true, warmup: false, weight: 80, reps: 10 };
    const warmupSet: WorkoutSet = { completed: true, warmup: true, weight: 80, reps: 10 };
    const uncompletedSet: WorkoutSet = { completed: false, warmup: false, weight: 80, reps: 10 };

    assert.equal(calculateSetVolume(validSet), 800);
    assert.equal(calculateSetVolume(warmupSet), 0);
    assert.equal(calculateSetVolume(uncompletedSet), 0);
  });

  test("calculateSetOneRepMax returns calculated 1RM for countable set, 0 otherwise", () => {
    const singleRep: WorkoutSet = { completed: true, warmup: false, weight: 100, reps: 1 };
    const multiRep: WorkoutSet = { completed: true, warmup: false, weight: 100, reps: 10 };
    const warmupSet: WorkoutSet = { completed: true, warmup: true, weight: 100, reps: 10 };

    assert.equal(calculateSetOneRepMax(singleRep), 100);
    // Epley: 100 * (1 + 10/30) = 133.33
    assert.equal(calculateSetOneRepMax(multiRep), 133.33);
    assert.equal(calculateSetOneRepMax(warmupSet), 0);
  });

  test("calculateTotalVolume and calculateWorkoutVolume only sum countable sets", () => {
    const sets: WorkoutSet[] = [
      { completed: true, warmup: true, weight: 60, reps: 10 }, // Warmup -> ignored
      { completed: true, warmup: false, weight: 100, reps: 5 }, // 500
      { completed: true, warmup: false, weight: 100, reps: 5 }, // 500
      { completed: false, warmup: false, weight: 100, reps: 5 }, // Incomplete -> ignored
    ];

    assert.equal(calculateTotalVolume(sets), 1000);
    assert.equal(calculateWorkoutVolume({ sets }), 1000);
  });

  test("calculateBest1RM finds the max 1RM among countable sets", () => {
    const sets: WorkoutSet[] = [
      { completed: true, warmup: true, weight: 200, reps: 5 }, // Warmup -> ignored
      { completed: true, warmup: false, weight: 100, reps: 5 }, // 1RM ~ 116.67
      { completed: true, warmup: false, weight: 120, reps: 3 }, // 1RM ~ 132.00
    ];

    assert.equal(calculateBest1RM(sets), 132);
  });

  test("isPersonalRecord evaluates true only for countable sets surpassing benchmark", () => {
    const recordSet: WorkoutSet = { completed: true, warmup: false, weight: 150, reps: 1 };
    const warmupHeavy: WorkoutSet = { completed: true, warmup: true, weight: 200, reps: 1 };

    assert.equal(isPersonalRecord(recordSet, 140), true);
    assert.equal(isPersonalRecord(recordSet, 160), false);
    assert.equal(isPersonalRecord(warmupHeavy, 140), false); // warmup ignored
  });

  test("calculateExerciseMaxWeight only checks countable sets", () => {
    const sets: WorkoutSet[] = [
      { completed: true, warmup: true, weight: 300, reps: 1 }, // Warmup
      { completed: true, warmup: false, weight: 225, reps: 5 },
      { completed: true, warmup: false, weight: 250, reps: 2 },
    ];

    assert.equal(calculateExerciseMaxWeight(sets), 250);
  });

  test("CSV export populates 1RM column only for countable sets", () => {
    const workout = {
      name: "Leg Day",
      date: "2026-10-14",
      sets: [
        { exercise_name: "Squat", weight: 100, reps: 10, completed: true, warmup: true }, // Warmup
        { exercise_name: "Squat", weight: 140, reps: 5, completed: true, warmup: false }, // Countable
      ],
    };

    const csv = exportWorkoutsToCsv([workout]);
    const lines = csv.trim().split("\n");
    // Row 1 (warmup): 1RM column is empty ("")
    const warmupRow = lines[1].split(",");
    assert.equal(warmupRow[9], ""); // 1RM column is index 9

    // Row 2 (countable): 1RM column is populated (140 * (1 + 5/30) = 163.33)
    const countableRow = lines[2].split(",");
    assert.equal(countableRow[9], "163.33");
  });
});
