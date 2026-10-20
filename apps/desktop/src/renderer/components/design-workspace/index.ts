/**
 * The design-workspace layer: everything a ship designer screen composes. Any screen that hosts
 * the designer (the Drawing Board, the Shipbuilding workspace) imports through this barrel.
 */

// Draft state, autosave and the content seam.
export { useDrawingBoard } from "./useDrawingBoard.js";
export { useDraftAutosave } from "./useDraftAutosave.js";
export { useRestoredDraftToast } from "./useRestoredDraftToast.js";
export { handleUndoShortcut, SHORTCUT_MOD, SHORTCUT_SHIFT } from "./undoShortcut.js";
export {
  TECHNOLOGY_MONTHS,
  technologyMonths,
  useDesignSession,
  type DesignSession,
} from "./useDesignSession.js";
export { loadDrawingBoardContent, setDrawingBoardContent } from "./content.js";
export { useDrawingBoardContentSource } from "./useDrawingBoardContent.js";
export type { RevisionProject } from "./revisionPreview.js";

// Selection store and drawing-to-form linking.
export { createSelectionStore } from "./selection/store.js";
export { ShipSelectionProvider } from "./selection/useShipSelection.js";
export { useFormNavigation } from "./selection/useFormNavigation.js";
export { entityExists, type EntityContext } from "./selection/facts.js";
export {
  BOARD_TABS,
  findDrawingControl,
  linkedEntities,
  type BoardTab,
} from "./selection/navigation.js";
export { SelectionInspector } from "./selection/SelectionInspector.js";

// Findings and validation.
export { boardFindings } from "./validation/boardFindings.js";
export { ShipFindingsButton, useFindingsView } from "./validation/FindingsControl.js";
export { passesFilter } from "./validation/severity.js";

// Panel library and the hull plan's editing surface.
export * from "./panels/index.js";
export { IDLE_TOOL, type PlanTool } from "./panels/hull-plan/PlanToolbar.js";
export { planModel } from "./panels/hull-plan/planModel.js";
export { StarterProfile } from "./panels/hull-plan/StarterProfile.js";
export { ShipTypeDetails, ShipTypeFacts } from "./panels/ShipTypeDetails.js";
export { NationalIdentityPanel } from "./panels/NationalIdentityPanel.js";
export { CATEGORY_LABEL } from "./shipTypes.js";
export { useHullPlanEditing } from "./panels/hull-plan/useHullPlanEditing.js";

// Workspace frame and shared controls.
export { ShipViewBoundary } from "./workspace/ShipViewBoundary.js";
export { ShipWorkspace } from "./workspace/ShipWorkspace.js";
export { ConfirmDialog } from "./ConfirmAction.js";
export { ChoiceProblemDialog } from "./ChoiceProblemDialog.js";
export { PlanDisplayMenu } from "./PlanDisplayMenu.js";
export { RequirementChip } from "./RequirementChip.js";
export { SelectField } from "./fields.js";
export { batteryCards, mountNameMap } from "./batteryView.js";
export { shipTypeIcon } from "./ship-type-icon.js";
export { shipTypeChoices, shipTypeRole, type ShipTypeChoice } from "./shipTypes.js";
export { plural } from "./plural.js";
