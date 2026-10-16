import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
  type PreferencesSnapshot,
  type WriteAppPreferencesRequest,
} from "../../shared/preferences-contract.js";

/**
 * A test double for the preload bridge's `preferences` capability (D6): `read`
 * resolves an in-memory snapshot, `write` records every request and adopts the
 * written app object. Only the preferences capability is implemented; other
 * bridge members are unused by the preferences consumers, so the object is cast
 * to the bridge shape for the test.
 */
export interface PreferencesBridgeStub {
  readonly bridge: BluewaveDesktopBridge;
  readonly writes: readonly WriteAppPreferencesRequest[];
  readCalls(): number;
  current(): PreferencesSnapshot;
}

export function createPreferencesBridgeStub(
  initial: AppPreferences = DEFAULT_APP_PREFERENCES,
): PreferencesBridgeStub {
  let current: PreferencesSnapshot = { version: PREFERENCES_SCHEMA_VERSION, app: initial };
  const writes: WriteAppPreferencesRequest[] = [];
  let readCalls = 0;

  const preferences = {
    read: async (): Promise<BridgeResult<PreferencesSnapshot>> => {
      readCalls += 1;
      return { outcome: "success", value: current, diagnostics: [] };
    },
    write: async (
      request: WriteAppPreferencesRequest,
    ): Promise<BridgeResult<PreferencesSnapshot>> => {
      writes.push(request);
      current = { version: PREFERENCES_SCHEMA_VERSION, app: request.app };
      return { outcome: "success", value: current, diagnostics: [] };
    },
  };

  return {
    bridge: { preferences } as BluewaveDesktopBridge,
    writes,
    readCalls: () => readCalls,
    current: () => current,
  };
}
