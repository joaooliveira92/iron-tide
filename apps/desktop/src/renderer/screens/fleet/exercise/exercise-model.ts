import type {
  FleetDivisionView,
  FleetExerciseProjection,
  FleetExerciseTensionPreview,
  FleetExerciseTensionRow,
  FleetScreenProjection,
} from "../../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";
import { translate } from "../../../lib/strings.js";

export interface ExerciseShipRow {
  readonly shipId: string;
  readonly name: string;
  readonly areaId: string;
  readonly eligible: boolean;
  readonly exercising: boolean;
}

export interface ExerciseState extends RequestLifecycle {
  readonly exercise: FleetExerciseProjection | null;
  readonly divisions: readonly FleetDivisionView[];
}

export function initialExerciseState(): ExerciseState {
  return {
    revision: 0,
    exercise: null,
    divisions: [],
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectExercise(projection: FleetScreenProjection): Partial<ExerciseState> {
  return { exercise: projection.exercise ?? null, divisions: projection.divisions };
}

export function exerciseRows(divisions: readonly FleetDivisionView[]): ExerciseShipRow[] {
  return divisions.flatMap((division) =>
    division.ships.map((ship) => ({
      shipId: ship.shipId,
      name: ship.name,
      areaId: division.areaId,
      eligible: ship.readiness === "ACTIVE" && ship.stationAssignment === undefined,
      exercising: ship.stationAssignment === "EXERCISE",
    })),
  );
}

export function limitReached(exercise: FleetExerciseProjection): boolean {
  return exercise.heldInNextExerciseYear >= exercise.maxPerCalendarYear;
}

const GATE_REASON_CODES: ReadonlySet<string> = new Set([
  "UnderConstruction",
  "Unavailable",
  "WorkingUp",
  "InRepair",
  "InReserve",
  "Mothballed",
  "InBattle",
  "Assigned",
  "AssignmentForbidsUse",
  "EMPTY_BATCH",
  "DUPLICATE_SHIP",
  "NOT_OWNED",
]);

export interface ExerciseTensionOutlook {
  readonly belowThreshold: boolean;
  readonly rows: readonly FleetExerciseTensionRow[];
}

export function tensionOutlook(
  preview: FleetExerciseTensionPreview,
  selectedCount: number,
): ExerciseTensionOutlook {
  return selectedCount < preview.minShips
    ? { belowThreshold: true, rows: [] }
    : { belowThreshold: false, rows: preview.rows };
}

export function explainExerciseRejection(
  diagnostics: readonly string[],
  rows: readonly ExerciseShipRow[],
): string[] {
  const names = new Map(rows.map((row) => [row.shipId, row.name]));
  const lines: string[] = [translate("fleet.exercise.rejected")];
  for (const diagnostic of diagnostics) {
    const detail = diagnostic.includes(": ")
      ? diagnostic.slice(diagnostic.indexOf(": ") + 2)
      : diagnostic;
    const pairs = detail.split(", ").map((part) => part.split("="));
    if (pairs.every((pair) => pair.length === 2 && GATE_REASON_CODES.has(pair[1]!))) {
      for (const [id, code] of pairs as [string, string][]) {
        const name = id === "<batch>" || id === "" ? "" : (names.get(id) ?? id);
        lines.push(translate(`fleet.exercise.gate.${code}`, { name }));
      }
    } else lines.push(diagnostic);
  }
  return lines;
}
