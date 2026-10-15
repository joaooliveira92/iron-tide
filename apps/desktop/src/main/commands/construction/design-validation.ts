import { placeConstructionOrder, type ConstructionOrderResult } from "@bluewave/phase-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import type { ConstructionCommandOutcome } from "../../../shared/construction-contract.js";
import type { CampaignSessionRecord } from "../../campaignSessions.js";

/**
 * The construction-order check shared by submit and replace, run BEFORE anything is reserved or persisted (F2). The
 * rule itself (design exists and belongs to the player, revalidation, auxiliary fleet limits) is the engine-side
 * `placeConstructionOrder` policy (ADR-0088); this adapter only supplies the session's snapshot and content and maps a
 * refusal to the bridge result.
 */
export type PlacedOrder =
  | Extract<ConstructionOrderResult, { readonly ok: true }>
  | { readonly ok: false; readonly result: BridgeResult<ConstructionCommandOutcome> };

export function placeOrderFor(
  record: CampaignSessionRecord,
  commandId: string,
  designId: string,
  content: ShipBuildingContent,
  replacingCommandId?: string,
): PlacedOrder {
  const placed = placeConstructionOrder(
    record.state.snapshot,
    {
      nationId: record.playerSlotId,
      commandId,
      designVersionId: designId,
      month: record.month,
      ...(replacingCommandId === undefined ? {} : { replacingCommandId }),
    },
    content,
  );
  if (placed.ok) return placed;
  return {
    ok: false,
    result: {
      outcome: "rejected",
      reason: placed.reason,
      diagnostics: [...placed.diagnostics],
    },
  };
}
