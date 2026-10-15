/**
 * Public facade for the desktop construction-workspace domain.
 *
 * The domain was once one 500-line module that owned the command contract, the
 * session-scoped registry lifecycle, snapshot reconstruction, reservation
 * requirements, economy derivation, UI projection, the command-record
 * lifecycle and settlement — seven reasons to change, and the hub every other
 * construction module imported. It is now split by responsibility under
 * `./construction/`; this file only re-exports the public surface so importers
 * keep a single, stable entry point.
 *
 * Exports are named explicitly (not `export *`) so the public API is
 * intentional and a duplicate identifier can never silently break the build.
 */
export {
  CONSTRUCTION_COMMAND_TYPE_ID,
  CONSTRUCTION_COMMAND_SCHEMA_VERSION,
  CONSTRUCTION_SETTLEMENT_BRANCH_ID,
  CONSTRUCTION_REFUND_BRANCH,
  CONSTRUCTION_COMMAND_DEFINITION,
} from "./construction/commandDefinition.js";
export { constructionEconomy } from "./construction/economy.js";
export { reservationRequirementsFor } from "./construction/reservationRequirements.js";
export {
  toWorkEnvelope,
  acceptConstructionRecord,
  campaignMonthKey,
  withRecordStatus,
} from "./construction/commandRecord.js";
export { settleAndRelease } from "./construction/settlement.js";
export { workspaceView, type ConstructionScreenWorkspace } from "./construction/view.js";
export {
  getConstructionWorkspace,
  syncReservationPools,
  clearConstructionWorkspace,
  hasConstructionWorkspace,
  clearConstructionWorkspacesForTest,
} from "./construction/workspace.js";
export type { ConstructionWorkspace } from "./construction/workspaceState.js";
