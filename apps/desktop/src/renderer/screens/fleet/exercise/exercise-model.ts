import type {
  FleetDivisionView,
  FleetExerciseProjection,
  FleetScreenProjection,
} from "../../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";

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

const GATE_REASON_TEXT: Readonly<Record<string, string>> = {
  UnderConstruction: "is still under construction.",
  Unavailable: "is under rebuild.",
  WorkingUp: "is still working up.",
  InRepair: "is under repair.",
  InReserve: "is in reserve.",
  Mothballed: "is mothballed.",
  InBattle: "is committed to a battle.",
  Assigned: "holds an assignment.",
  AssignmentForbidsUse: "holds an assignment that bars this.",
  EMPTY_BATCH: "No ship was selected.",
  DUPLICATE_SHIP: "was selected more than once.",
  NOT_OWNED: "is not one of your ships.",
};

export function explainExerciseRejection(
  diagnostics: readonly string[],
  rows: readonly ExerciseShipRow[],
): string[] {
  const names = new Map(rows.map((row) => [row.shipId, row.name]));
  const lines: string[] = ["Fleet exercise rejected. Nothing was queued."];
  for (const diagnostic of diagnostics) {
    const detail = diagnostic.includes(": ")
      ? diagnostic.slice(diagnostic.indexOf(": ") + 2)
      : diagnostic;
    const pairs = detail.split(", ").map((part) => part.split("="));
    if (pairs.every((pair) => pair.length === 2 && pair[1]! in GATE_REASON_TEXT)) {
      for (const [id, code] of pairs as [string, string][]) {
        const reason = GATE_REASON_TEXT[code]!;
        lines.push(id === "<batch>" || id === "" ? reason : `${names.get(id) ?? id} ${reason}`);
      }
    } else lines.push(diagnostic);
  }
  return lines;
}
