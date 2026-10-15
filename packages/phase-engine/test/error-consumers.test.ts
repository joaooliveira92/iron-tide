// Regression tests for the migrated PhaseEngineError throws: a real consumer
// path must still observe the stable reason code / message it relied on before
// the plain-`Error` → `Data.TaggedError` conversion (MIG-RUNTIME-1, MIG-DET-1).
// `TacticalReplayVerifier.verify` is the public fail-closed consumer: it wraps
// `resolveBattleAuto` and surfaces a stable `TACTICAL_REPLAY_ERROR` diagnostic
// rather than crashing.

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

    // Strip the attacker's committed ships so `resolveBattleAuto` fail-closes
    // ("both sides require at least one committed, promotable ship") while the
    // stored manifest still passes the tamper check — the catch path runs.
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
