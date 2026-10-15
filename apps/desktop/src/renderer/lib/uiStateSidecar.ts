import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type {
  UiState,
  UiStateFirstMonthInspection,
  UiStateInspectorLayout,
} from "../../shared/campaign-command-contract.js";

/** The optional fields a caller may write; each is carried forward from the sidecar when absent. */
export interface UiStatePatch {
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  readonly inspector?: UiStateInspectorLayout;
}

/**
 * Writes a UI-state patch through the renderer-owned `ui-state.json` sidecar (ADR-0038). The bridge's
 * `writeUiState` replaces the dismissal set outright, so the current set is read back first and carried
 * through — the shared read-before-write merge that keeps two features (guided inspection, the
 * shipbuilding inspector) from erasing each other. Returns the resulting sidecar, or undefined when the
 * write could not be made (no bridge, or a failed result).
 */
export async function writeUiStatePatch(
  bridge: BluewaveDesktopBridge | undefined,
  sessionId: string,
  patch: UiStatePatch,
): Promise<UiState | undefined> {
  if (bridge === undefined) return undefined;
  const before = await bridge.campaign.execute("readUiState", sessionId);
  const dismissedFingerprints =
    before.outcome === "success" ? [...before.value.uiState.dismissedFingerprints] : [];
  const result = await bridge.campaign.execute("writeUiState", {
    sessionId,
    dismissedFingerprints,
    ...patch,
  });
  return result.outcome === "success" ? result.value.uiState : undefined;
}
