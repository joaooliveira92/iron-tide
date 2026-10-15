import type {
  CampaignConfiguration as EngineCampaignConfiguration,
  CampaignSnapshot,
} from "@bluewave/campaign";

/**
 * The real engine type, plus an optional `archetype` field — grounded in
 * two independent New Game screens (`new-game-nation-screen-state.ts`,
 * `NewGameNationScreen.tsx`) that both attach a serialized archetype
 * selection to the compile payload. `compileCampaign`'s implementation
 * decides whether to act on it; per ticket 07's addendum, it travels
 * through honestly rather than being silently dropped.
 */
export type CampaignConfiguration = EngineCampaignConfiguration & {
  readonly archetype?: string;
};

/**
 * Per-field valid option ids, keyed to match each screen's actual usage
 * (grounded in `RulesetOptionsSection.tsx` and `new-game-nation-screen-state.ts`
 * — the naming isn't uniform because the two screens were built against
 * different naming conventions independently: `playerSlotId` mirrors
 * `CampaignConfiguration`'s field name, the rest mirror `DraftPreferences`'
 * shorter names).
 *
 * `historicalBudget`/`legacyFleetMode`/`tacticalRealism`/`difficulty` are
 * ruleset-content-driven option catalogs (`CampaignConfiguration`'s
 * corresponding fields are untyped `string`, not fixed code enums) — their
 * values come from the compiled content pack at runtime, not from a
 * hardcoded list here.
 */
export interface SupportedConfigurationValues {
  readonly scenarioId: readonly string[];
  readonly continuityMode: readonly string[];
  readonly fleetSize: readonly string[];
  readonly researchSpeed: readonly string[];
  readonly technologyVariation: readonly string[];
  readonly historicalBudget: readonly string[];
  readonly legacyFleetMode: readonly string[];
  readonly tacticalRealism: readonly string[];
  readonly difficulty: readonly string[];
  /** Nations the engine can currently run as a player slot — excludes
   * zero-content nations per the desktop-mvp map's empty-nation-content-gap
   * decision. */
  readonly playerSlotId: readonly string[];
}

/**
 * A nation with zero ship designs *and* zero construction projects of its
 * own leaves the player with nothing to build on the Construction screen
 * (desktop-mvp map, Empty-Nation Content Gap ticket 06 — e.g. Spain in
 * `content/production/1880`). Computed from the compiled snapshot rather
 * than a hardcoded nation list, so it tracks whatever content pack is
 * actually loaded.
 */
export function hasOwnContent(snapshot: CampaignSnapshot, nationId: string): boolean {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return false;
  if (nation.constructionProjects.length > 0) return true;
  for (const design of snapshot.designs.values()) {
    if (design.nationId === nationId) return true;
  }
  return false;
}

/**
 * `SupportedConfigurationValues.playerSlotId` — every playable nation in the
 * compiled snapshot that also has its own content (ticket 06's gate).
 * Sorted for deterministic UI ordering.
 */
export function supportedPlayerSlotIds(snapshot: CampaignSnapshot): readonly string[] {
  const ids: string[] = [];
  for (const [nationId, nation] of snapshot.nations) {
    if (!nation.isPlayable) continue;
    if (!hasOwnContent(snapshot, nationId)) continue;
    ids.push(nationId);
  }
  return ids.sort((a, b) => a.localeCompare(b));
}
