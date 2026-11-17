import {
  advanceFleetRoutes,
  applyDivisionCommand,
  checkDivisionInvariants,
  describeFleetMoveProblem,
  DIVISION_STATE_INVARIANT_FAILED,
  fleetMoveProblem,
  isWholeFleet,
  orderFleetRoute,
  type CampaignSnapshot,
  type PermanentDivision,
} from "@bluewave/campaign";
import type { MoveFleetCommand } from "@bluewave/commands";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result } from "effect";
import { divisionAssetsFor } from "./divisionCommands.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";

function divisionsAfterDetach(
  snapshot: CampaignSnapshot,
  nationId: string,
  shipIds: readonly string[],
  month: string,
  collector: DiagnosticCollector,
): PermanentDivision[] | null {
  const nation = snapshot.nations.get(nationId)!;
  const ordered = new Set(shipIds);
  let divisions = nation.divisions;
  for (const division of nation.divisions) {
    const touched = division.shipOrder.filter((id) => ordered.has(id));
    if (touched.length === 0 || touched.length === division.shipOrder.length) continue;
    let next = division;
    for (const shipId of touched) {
      next = applyDivisionCommand(next, { type: "remove_ship", shipId }, month).division;
    }
    const invariants = checkDivisionInvariants(
      next,
      divisionAssetsFor(snapshot, nationId, next.shipOrder),
      {},
    );
    if (Result.isFailure(invariants)) {
      collector.addError(
        DIVISION_STATE_INVARIANT_FAILED,
        `Ships ${touched.join(",")} cannot leave division ${division.divisionId}: ${invariants.failure.message}`,
        { stage: "command_collection" },
      );
      return null;
    }
    divisions = divisions.map((d) => (d.divisionId === division.divisionId ? next : d));
  }
  return divisions;
}

export function applyMoveFleet(
  currentSnapshot: CampaignSnapshot,
  body: MoveFleetCommand,
  collector: DiagnosticCollector,
  month: string,
): CampaignSnapshot {
  const nationId = body["nationId"];
  const fleetId = body["fleetId"];
  const shipIds = body["shipIds"];
  const problem = fleetMoveProblem(currentSnapshot, nationId, fleetId, body["toAreaId"], shipIds);
  if (problem !== null) {
    collector.addError(problem.code, describeFleetMoveProblem(problem), {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  const fleet = currentSnapshot.nations.get(nationId)!.fleets.find((f) => f.id === fleetId)!;
  let snapshot = currentSnapshot;
  if (shipIds !== undefined && !isWholeFleet(fleet, shipIds)) {
    const divisions = divisionsAfterDetach(currentSnapshot, nationId, shipIds, month, collector);
    if (divisions === null) return currentSnapshot;
    const nation = currentSnapshot.nations.get(nationId)!;
    const nations = new Map(currentSnapshot.nations);
    nations.set(nationId, { ...nation, divisions });
    snapshot = { ...currentSnapshot, nations };
  }
  return orderFleetRoute(snapshot, nationId, fleetId, body["toAreaId"], shipIds).snapshot;
}

export function runFleetMovementPhase(ctx: PhaseContext): PhaseRunOutcome {
  const view = ctx.snapshot.view();
  const before = { nations: view.nations, world: view.world };
  const moved = advanceFleetRoutes(before);
  if (moved.nations !== before.nations) ctx.snapshot.write("nations", moved.nations);
  return { status: "continue" };
}

export const fleetMovementPhase: MonthPhase = {
  id: "fleet_movement",
  name: "Fleet Movement",
  permissions: {
    reads: ["nations", "world"],
    writes: ["nations"],
    rng: false,
  },
  run: runFleetMovementPhase,
};
