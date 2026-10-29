import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { AppStartupSnapshot } from "../../shared/bridge-contract.js";

export const STARTUP_SNAPSHOT_TIMEOUT_MS = 250;

export async function loadStartupSnapshot(
  bridge: BluewaveDesktopBridge | undefined,
  timeoutMs: number = STARTUP_SNAPSHOT_TIMEOUT_MS,
): Promise<AppStartupSnapshot | null> {
  if (bridge?.readStartupSnapshot === undefined) return null;
  try {
    const result = await Promise.race([
      bridge.readStartupSnapshot(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (result === null) return null;
    return result.outcome === "success" ? result.value : null;
  } catch {
    return null;
  }
}
