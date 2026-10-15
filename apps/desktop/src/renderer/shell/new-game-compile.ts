import { defaultArchetypeSelection, serializeArchetypeSelection } from "@bluewave/campaign-engine";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { buildCampaignConfiguration } from "../screens/new-game/new-game-nation-screen-state.js";
import type { LaunchableDraft, NewGameDraft } from "./new-game-draft.js";

type NewGameBridge = Pick<BluewaveDesktopBridge, "campaign">;

/**
 * The one `compileCampaign` rejection reason that isn't a failure (spec §7)
 * — the player hit Cancel on the native save-location dialog. Handled
 * silently: back to the review screen, selections intact, no error banner.
 */
const SAVE_LOCATION_CANCELLED = "SAVE_LOCATION_CANCELLED";

export type NewGameCompileResult =
  | { readonly kind: "compiled"; readonly sessionId: string }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failed"; readonly message: string };

/** True once the wizard has the nation's preferences and fleet method the compiler needs. */
export function isLaunchableDraft(draft: NewGameDraft | null): draft is LaunchableDraft {
  return draft !== null && draft.preferences !== null && draft.fleetMethod !== null;
}

/**
 * Turns the wizard draft into a `compileCampaign` request and runs it, mapping
 * the transport outcome to a closed union. Owns archetype serialization and
 * config assembly so the flow hook only navigates on the result.
 */
export async function compileNewGame(
  bridge: NewGameBridge,
  draft: LaunchableDraft,
): Promise<NewGameCompileResult> {
  const archetypeToken = serializeArchetypeSelection(
    draft.archetype ?? defaultArchetypeSelection(),
  );
  const config = {
    ...buildCampaignConfiguration(
      draft.nationId,
      draft.preferences,
      draft.fleetMethod.legacyFleetModeId,
    ),
    archetype: archetypeToken,
  };
  try {
    const result = await bridge.campaign.execute("compileCampaign", config);
    if (result.outcome !== "success") {
      if (result.reason === SAVE_LOCATION_CANCELLED) return { kind: "cancelled" };
      const diagnostics = result.diagnostics.length > 0 ? ` ${result.diagnostics.join("; ")}` : "";
      return { kind: "failed", message: `${result.reason}.${diagnostics}` };
    }
    return { kind: "compiled", sessionId: result.value.sessionId };
  } catch {
    return { kind: "failed", message: "COMPILE_FAILED." };
  }
}
