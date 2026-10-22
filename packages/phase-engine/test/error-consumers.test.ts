import type { CampaignSnapshot } from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, TacticalReplayVerifier } from "../src/index.js";
import { ATTACKER_NATION, CAMPAIGN_SEED, makeBattleSnapshot } from "./battle-fixtures.js";

describe("TacticalReplayVerifier error consumer (ticket 30 regression)", () => {
  it("surfaces a stable TACTICAL_REPLAY_ERROR diagnostic when re-resolution throws", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    expect(month.success).toBe(true);
    const fs = month.finalSnapshot;

    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };

    const nations = new Map(verifySnap.nations);
    const attacker = nations.get(ATTACKER_NATION);
    if (!attacker) throw new Error("fixture missing the attacker nation");
    nations.set(ATTACKER_NATION, { ...attacker, fleets: [] });
    const stripped: CampaignSnapshot = { ...verifySnap, nations };

    const result = new TacticalReplayVerifier().verify(stripped, CAMPAIGN_SEED);

    expect(result.match).toBe(false);
    expect(result.battles).toHaveLength(1);
    expect(result.battles[0]!.match).toBe(false);
    expect(result.battles[0]!.diagnostic).toMatch(/^TACTICAL_REPLAY_ERROR: /);
  });
});
