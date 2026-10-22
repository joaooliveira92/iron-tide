import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type {
  UiState,
  UiStateFirstMonthInspection,
  UiStateInspectorLayout,
  UiStateTurnMessages,
} from "../../shared/campaign-command-contract.js";

export interface UiStatePatch {
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  readonly inspector?: UiStateInspectorLayout;
  readonly turnMessages?: UiStateTurnMessages;
}

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
