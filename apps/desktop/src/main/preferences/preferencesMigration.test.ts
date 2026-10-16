import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
} from "../../shared/preferences-contract.js";
import { defaultPreferencesSnapshot, migratePreferencesFileData } from "./preferencesStore.js";

describe("preferences migration and recovery (U-2 ticket 06)", () => {
  it("decodes a valid current-version file without recovery", () => {
    const recovery = migratePreferencesFileData({
      version: PREFERENCES_SCHEMA_VERSION,
      app: DEFAULT_APP_PREFERENCES,
    });
    expect(recovery.recovered).toBe(false);
    expect(recovery.reason).toBeNull();
    expect(recovery.snapshot).toEqual(defaultPreferencesSnapshot());
  });

  it("recovers an unknown version to defaults with a reason", () => {
    const recovery = migratePreferencesFileData({ version: 0, app: {} });
    expect(recovery.recovered).toBe(true);
    expect(recovery.reason).toBe("unknown-version:0");
    expect(recovery.snapshot).toEqual(defaultPreferencesSnapshot());
  });

  it("recovers a corrupt or excess-keyed object to defaults", () => {
    expect(migratePreferencesFileData(null).recovered).toBe(true);
    expect(migratePreferencesFileData("nonsense").recovered).toBe(true);
    expect(
      migratePreferencesFileData({
        version: PREFERENCES_SCHEMA_VERSION,
        app: { ...DEFAULT_APP_PREFERENCES, extra: true },
      }).reason,
    ).toBe("undecodable");
  });

  it("is deterministic and idempotent", () => {
    const raw = { version: PREFERENCES_SCHEMA_VERSION, app: DEFAULT_APP_PREFERENCES };
    expect(migratePreferencesFileData(raw)).toEqual(migratePreferencesFileData(raw));
  });
});
