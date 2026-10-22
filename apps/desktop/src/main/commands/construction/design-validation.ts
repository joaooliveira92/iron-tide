import { placeConstructionOrder, type ConstructionOrderResult } from "@bluewave/phase-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import type { ConstructionCommandOutcome } from "../../../shared/construction-contract.js";
import type { CampaignSessionRecord } from "../../campaignSessions.js";

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
