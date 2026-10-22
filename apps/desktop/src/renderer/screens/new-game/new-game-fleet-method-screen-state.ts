export interface FleetMethodDraft {
  readonly legacyFleetModeId: string;
}

const DEFAULT_LEGACY_FLEET_MODE_ID = "generated";

export function defaultFleetMethod(): FleetMethodDraft {
  return { legacyFleetModeId: DEFAULT_LEGACY_FLEET_MODE_ID };
}
