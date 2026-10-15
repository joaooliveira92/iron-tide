import type { CommandRecord } from "@bluewave/commands";
import {
  buildConstructionDesignCatalog,
  designFamilyYear,
  isDesignBuildableByYear,
  projectedConstructionOrderCosts,
  type CompiledDesignVersion,
  type ConstructionCommand,
} from "@bluewave/campaign-engine";
import type { CampaignSessionRecord } from "../../campaignSessions.js";
import { uiStatusFor } from "./command-status.js";

/**
 * The UI-facing shape of a construction command. Owns everything the
 * Construction screen sees about a command record — resolving the compiled
 * design behind a design id and shaping a `ConstructionCommand` row. The
 * status vocabulary it shares with the workspace lives in `command-status.ts`;
 * writing a row's status back is a `ConstructionWorkspace` operation.
 */

/**
 * Resolve the UI-facing design for `designId`. Looks in the nation's compiled
 * catalog and falls back to a deterministic stub rather than crashing the
 * ledger if the design is no longer catalogued.
 */
export function resolveUiDesign(
  record: CampaignSessionRecord,
  designId: string,
): CompiledDesignVersion {
  const catalog = buildConstructionDesignCatalog(
    record.state.snapshot,
    record.playerSlotId,
    record.month.year,
  );
  const found = catalog.find((candidate) => candidate.designId === designId);
  if (found) return found;
  const engine = record.state.snapshot.designs.get(designId);
  const family =
    engine !== undefined && engine.designFamilyId !== ""
      ? record.state.snapshot.designFamilies.get(engine.designFamilyId)
      : undefined;
  const year = designFamilyYear(family?.familyCreationMonth);
  return {
    designId,
    className: engine?.className ?? designId,
    shipType: "unknown",
    nationId: record.playerSlotId,
    year,
    available: isDesignBuildableByYear(year, record.month.year),
    mass: 0,
    speed: 0,
    machineryType: engine?.machineryType ?? "",
    requiredTechnologyIds: [],
    ...(engine
      ? projectedConstructionOrderCosts(engine)
      : { projectedCost: 0, projectedCapacityUnits: 0 }),
    costBasis:
      engine?.constructionCostUnits !== undefined ? "design_cost_model" : "displacement_formula",
  };
}

export interface UiCommandInput {
  readonly recordRef: CommandRecord;
  readonly designId: string;
  readonly design: CompiledDesignVersion;
  readonly projectedCost: number;
  readonly projectedCapacityUnits: number;
  readonly submittedAtRevision: number;
}

/** Shape one recorded command into the Construction screen's row. */
export function toUiCommand(input: UiCommandInput): ConstructionCommand {
  return {
    commandId: input.recordRef.commandId,
    designId: input.designId,
    design: input.design,
    nationId: input.recordRef.issuerParticipantId,
    status: uiStatusFor(input.recordRef),
    submittedAtRevision: input.submittedAtRevision,
    projectedCost: input.projectedCost,
    projectedCapacityUnits: input.projectedCapacityUnits,
  };
}
