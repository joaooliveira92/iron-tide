import {
  createSettlementRecord,
  type CommandRecord,
  type CommandSettlementRecord,
  type SettlementBranchId,
} from "@bluewave/commands";
import { CONSTRUCTION_REFUND_BRANCH } from "./commandDefinition.js";
import type { ConstructionWorkspace } from "./workspaceState.js";

export function settleAndRelease(
  workspace: ConstructionWorkspace,
  record: CommandRecord,
  settlementBranchId: SettlementBranchId,
  reservedAmount: number,
): CommandSettlementRecord {
  const settlement = createSettlementRecord(
    record.commandId,
    settlementBranchId,
    CONSTRUCTION_REFUND_BRANCH,
    reservedAmount,
    0,
  );
  workspace.release(record.commandId);
  return settlement;
}
