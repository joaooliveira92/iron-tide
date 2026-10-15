import type { ArchetypeSelection } from "@bluewave/campaign-engine";

import type { NewGameOptions } from "../../shared/new-game-contract.js";
import type { AdmiralPresetValues } from "../screens/new-game/admiral-preset.js";
import type { FleetMethodDraft } from "../screens/new-game/new-game-fleet-method-screen-state.js";
import type { CampaignIdentityDraft } from "../screens/new-game/new-game-identity-screen-state.js";
import type { DraftPreferences } from "../screens/new-game/new-game-preferences-screen-state.js";

/** The accumulating choices of the new-campaign wizard, step by step. */
export interface NewGameDraft {
  readonly nationId: string;
  readonly preferences: DraftPreferences | null;
  readonly options: NewGameOptions | null;
  readonly archetype: ArchetypeSelection | null;
  readonly identity: CampaignIdentityDraft | null;
  readonly fleetMethod: FleetMethodDraft | null;
  readonly recommendedPreset: AdmiralPresetValues | null;
}

/** A draft with the two fields the compiler needs — what `compileNewGame` requires. */
export type LaunchableDraft = NewGameDraft & {
  readonly preferences: DraftPreferences;
  readonly fleetMethod: FleetMethodDraft;
};

/** Carries a `NewGameDraft`'s other fields forward while swapping in `nationId`. */
export function draftWithNation(current: NewGameDraft | null, nationId: string): NewGameDraft {
  return {
    nationId,
    preferences: current?.preferences ?? null,
    options: current?.options ?? null,
    archetype: current?.archetype ?? null,
    identity: current?.identity ?? null,
    fleetMethod: current?.fleetMethod ?? null,
    recommendedPreset: current?.recommendedPreset ?? null,
  };
}
