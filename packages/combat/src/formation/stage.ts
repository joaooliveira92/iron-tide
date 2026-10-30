import type { MovementState } from "../movement/state.js";
import { appendTrackPoint } from "./track.js";
import { planDivisionSteering } from "./steering.js";
import type {
  FormationContext,
  FormationDivisionView,
  FormationShipView,
  FormationTrack,
  ShipOrderOverride,
  ShipStationRecord,
} from "./contracts.js";
import { validateFormationKeepingRuleset } from "./contracts.js";
import type { TacticalDivision } from "../tactical/division.js";

export interface FormationShipSource {
  assetId: string;
  designedSpeedUms: number;
}

export interface FormationUnitOrders {
  orderedHeading: number;
  orderedSpeedBp: number;
  attainableMaxBp?: number;
}

const KNOT_UM_PER_S = 514_444;

function designedSpeedBp(ums: number): number {
  return Math.round((ums * 1_000) / KNOT_UM_PER_S);
}

export interface FormationRuntime {
  divisions: readonly FormationDivisionView[];
  tracks: Record<string, FormationTrack>;
  records: ShipStationRecord[];
}

export function buildFormationDivisions(
  divisions: readonly TacticalDivision[],
  presentAssetIds: ReadonlySet<string>,
): FormationDivisionView[] {
  const sideCounters = new Map<string, number>();
  const views: FormationDivisionView[] = [];
  for (const division of divisions) {
    const index = sideCounters.get(division.sideId) ?? 0;
    sideCounters.set(division.sideId, index + 1);
    const present = division.orderedTacticalUnitIds.filter((id) => presentAssetIds.has(id));
    if (present.length < 2 || !present.includes(division.tacticalFlagshipId)) continue;
    const memberIds = [
      division.tacticalFlagshipId,
      ...present.filter((id) => id !== division.tacticalFlagshipId),
    ];
    views.push({
      divisionId: division.tacticalDivisionId,
      formation: division.formation,
      flagshipId: division.tacticalFlagshipId,
      memberIds,
      divisionIndex: index,
    });
  }
  return views;
}

export function createFormationRuntime(
  context: FormationContext,
  divisions: readonly TacticalDivision[],
  presentAssetIds: ReadonlySet<string>,
): FormationRuntime {
  validateFormationKeepingRuleset(context.ruleset);
  return {
    divisions: buildFormationDivisions(divisions, presentAssetIds),
    tracks: { ...context.tracks },
    records: [],
  };
}

function viewShips(
  runtime: FormationRuntime,
  movements: Readonly<Record<string, MovementState>>,
  orders: Readonly<Record<string, FormationUnitOrders>>,
  sources: Readonly<Record<string, FormationShipSource>>,
): Record<string, FormationShipView> {
  const ships: Record<string, FormationShipView> = {};
  for (const division of runtime.divisions) {
    for (const id of division.memberIds) {
      const movement = movements[id]!;
      const order = orders[id];
      ships[id] = {
        assetId: id,
        position: movement.position,
        heading: movement.heading,
        orderedHeading: order?.orderedHeading ?? movement.heading,
        orderedSpeedBp: order?.orderedSpeedBp ?? movement.orderedSpeed,
        attainableMaxBp:
          order?.attainableMaxBp ?? designedSpeedBp(sources[id]?.designedSpeedUms ?? 0),
      };
    }
  }
  return ships;
}

export function recordFlagshipTracks(
  runtime: FormationRuntime,
  context: FormationContext,
  movements: Readonly<Record<string, MovementState>>,
): void {
  for (const division of runtime.divisions) {
    const flagship = movements[division.flagshipId]!;
    const existing = runtime.tracks[division.divisionId] ?? {
      divisionId: division.divisionId,
      points: [],
    };
    runtime.tracks[division.divisionId] = appendTrackPoint(
      existing,
      flagship.position,
      context.ruleset.trackCapacity,
    );
  }
}

export function planFormationSubstep(
  runtime: FormationRuntime,
  context: FormationContext,
  movements: Readonly<Record<string, MovementState>>,
  orders: Readonly<Record<string, FormationUnitOrders>>,
  sources: Readonly<Record<string, FormationShipSource>>,
): { overrides: Record<string, ShipOrderOverride>; records: ShipStationRecord[] } {
  const ships = viewShips(runtime, movements, orders, sources);
  const overrides: Record<string, ShipOrderOverride> = {};
  const records: ShipStationRecord[] = [];
  for (const division of runtime.divisions) {
    const plan = planDivisionSteering({
      division,
      ships,
      ruleset: context.ruleset,
      turnTogether: context.turnTogether?.[division.divisionId] === true,
      track: runtime.tracks[division.divisionId],
    });
    Object.assign(overrides, plan.overrides);
    records.push(...plan.records);
  }
  return { overrides, records };
}
