/**
 * A shared test/tooling helper for seeding the app-scope preferences file
 * (U-2 ticket 01). The desktop app reads preferences from
 * `<userDataDir>/preferences.json` through the main-process store, not
 * `localStorage`, so the e2e harness and the `snap` tool seed that file then
 * reload. Sourced from the effect-free contract so the shape cannot drift.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
} from "../src/shared/preferences-contract.ts";

export const PREFERENCES_FILENAME = "preferences.json";

/** Writes a full `{ version, app }` snapshot into the harness user-data dir. */
export function writeAppPreferences(
  userDataDir: string,
  override: Partial<AppPreferences> = {},
): void {
  const app: AppPreferences = { ...DEFAULT_APP_PREFERENCES, ...override };
  writeFileSync(
    join(userDataDir, PREFERENCES_FILENAME),
    `${JSON.stringify({ version: PREFERENCES_SCHEMA_VERSION, app }, null, 2)}\n`,
  );
}
