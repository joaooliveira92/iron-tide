/**
 * `legacyFleetModeId` mirrors the engine's validated `legacyFleetModeId`
 * string (`packages/campaign/src/scenario.ts`) — kept as a plain string here
 * rather than importing the engine's id union, matching `DraftPreferences`'
 * existing `legacyFleetMode: string` field.
 */
export interface FleetMethodDraft {
  readonly legacyFleetModeId: string;
}

const DEFAULT_LEGACY_FLEET_MODE_ID = "generated";

export function defaultFleetMethod(): FleetMethodDraft {
  return { legacyFleetModeId: DEFAULT_LEGACY_FLEET_MODE_ID };
}
