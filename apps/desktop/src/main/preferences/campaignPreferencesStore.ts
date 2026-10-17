// The campaign-scope preferences store (D3). A JSON sidecar in the campaign save
// directory (a sibling of the save ids, outside the envelope/hash), written
// atomically and read tolerantly: a missing, unreadable or undecodable file
// recovers to the central defaults. It is non-authoritative — it never touches a
// save or a golden hash (D7).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Context, Effect, Layer, Result, Schema } from "effect";
import {
  DEFAULT_CAMPAIGN_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type CampaignPreferences,
  type CampaignPreferencesSnapshot,
} from "../../shared/preferences-contract.js";
import { atomicWrite } from "../runtime/atomicWrite.js";
import {
  PreferencesReadFailed,
  PreferencesWriteFailed,
  type PreferencesError,
} from "./preferencesErrors.js";
import { CampaignPreferencesFileSchema } from "./preferencesSchema.js";

/** The campaign-scope sidecar name, a sibling of the save ids in the campaign dir. */
export const CAMPAIGN_PREFERENCES_FILENAME = "campaign-preferences.json";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The tolerant read fallback (and the initial shape). */
export function defaultCampaignPreferencesSnapshot(): CampaignPreferencesSnapshot {
  return { version: PREFERENCES_SCHEMA_VERSION, campaign: DEFAULT_CAMPAIGN_PREFERENCES };
}

/** The decoded snapshot, or the defaults for a missing/corrupt/undecodable file. */
export function loadCampaignPreferencesFile(saveDir: string): CampaignPreferencesSnapshot {
  const path = join(saveDir, CAMPAIGN_PREFERENCES_FILENAME);
  if (!existsSync(path)) return defaultCampaignPreferencesSnapshot();
  try {
    const decoded = Schema.decodeUnknownResult(CampaignPreferencesFileSchema, {
      onExcessProperty: "error",
    })(JSON.parse(readFileSync(path, "utf8")));
    if (Result.isFailure(decoded)) return defaultCampaignPreferencesSnapshot();
    return { version: decoded.success.version, campaign: decoded.success.campaign };
  } catch {
    return defaultCampaignPreferencesSnapshot();
  }
}

export interface CampaignPreferencesStoreShape {
  readonly read: (saveDir: string) => Effect.Effect<CampaignPreferencesSnapshot, PreferencesError>;
  readonly write: (
    saveDir: string,
    campaign: CampaignPreferences,
  ) => Effect.Effect<CampaignPreferencesSnapshot, PreferencesError>;
}

export class CampaignPreferencesStore extends Context.Service<
  CampaignPreferencesStore,
  CampaignPreferencesStoreShape
>()("bluewave/desktop/CampaignPreferencesStore") {}

export function campaignPreferencesStoreLayer(): Layer.Layer<CampaignPreferencesStore> {
  return Layer.succeed(CampaignPreferencesStore, {
    read: (saveDir) =>
      Effect.try({
        try: () => loadCampaignPreferencesFile(saveDir),
        catch: (error) =>
          new PreferencesReadFailed({
            reason: "CAMPAIGN_PREFERENCES_READ_FAILED",
            diagnostics: [messageOf(error)],
          }),
      }),
    write: (saveDir, campaign) =>
      Effect.try({
        try: () => {
          const snapshot: CampaignPreferencesSnapshot = {
            version: PREFERENCES_SCHEMA_VERSION,
            campaign,
          };
          atomicWrite(
            join(saveDir, CAMPAIGN_PREFERENCES_FILENAME),
            JSON.stringify(snapshot, null, 2),
          );
          return snapshot;
        },
        catch: (error) =>
          new PreferencesWriteFailed({
            reason: "CAMPAIGN_PREFERENCES_WRITE_FAILED",
            diagnostics: [messageOf(error)],
          }),
      }),
  });
}
