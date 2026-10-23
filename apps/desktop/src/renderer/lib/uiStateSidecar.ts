import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { UiState, UiStatePatch } from "../../shared/ui-state-contract.js";

export async function readUiState(
  bridge: BluewaveDesktopBridge | undefined,
  sessionId: string,
): Promise<UiState | undefined> {
  if (bridge === undefined) return undefined;
  const result = await bridge.campaign.execute("readUiState", sessionId);
  return result.outcome === "success" ? result.value.uiState : undefined;
}

export async function writeUiStatePatch(
  bridge: BluewaveDesktopBridge | undefined,
  sessionId: string,
  patch: UiStatePatch,
): Promise<UiState | undefined> {
  if (bridge === undefined) return undefined;
  const result = await bridge.campaign.execute("writeUiState", { sessionId, ...patch });
  return result.outcome === "success" ? result.value.uiState : undefined;
}
