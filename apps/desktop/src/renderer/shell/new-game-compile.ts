import { defaultArchetypeSelection, serializeArchetypeSelection } from "@bluewave/campaign-engine";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { buildCampaignConfiguration } from "../screens/new-game/new-game-nation-screen-state.js";
import type { LaunchableDraft, NewGameDraft } from "./new-game-draft.js";

type NewGameBridge = Pick<BluewaveDesktopBridge, "campaign">;

const SAVE_LOCATION_CANCELLED = "SAVE_LOCATION_CANCELLED";

export type NewGameCompileResult =
  | { readonly kind: "compiled"; readonly sessionId: string }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failed"; readonly message: string };

export function isLaunchableDraft(draft: NewGameDraft | null): draft is LaunchableDraft {
  return draft !== null && draft.preferences !== null && draft.fleetMethod !== null;
}

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
