import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
} from "../src/shared/preferences-contract.ts";

export const PREFERENCES_FILENAME = "preferences.json";

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
