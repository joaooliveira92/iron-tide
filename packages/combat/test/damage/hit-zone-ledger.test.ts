import { describe, expect, it } from "vite-plus/test";
import { RandomLedger } from "@bluewave/random";
import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import { DAMAGE_REASON_CODES } from "@bluewave/combat/damage";
import { makeAutoInput, makeNations } from "../battle-resolution/fixtures.js";

const HIT_ZONE_PHASE = "resolve_battle_auto_resolution_hit_zone";

function hitZoneDraws() {
  const ledger = new RandomLedger();
  resolveBattleAuto({
    ...makeAutoInput({ nations: makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] }) }),
    randomLedger: ledger,
  });
  return ledger.all.filter((decision) => decision.phase === HIT_ZONE_PHASE);
}

describe("hit-zone draw provenance", () => {
  it("records an input hash for every hit-zone draw", () => {
    const draws = hitZoneDraws();

    expect(draws.length).toBeGreaterThan(0);
    for (const draw of draws) expect(draw.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a reason code from the damage catalogue", () => {
    const catalogue: readonly string[] = Object.values(DAMAGE_REASON_CODES);

    for (const draw of hitZoneDraws()) expect(catalogue).toContain(draw.reasonCode);
  });

  it("gives distinct draws distinct input hashes", () => {
    const draws = hitZoneDraws();
    const byStream = new Map(draws.map((draw) => [draw.streamId, draw.inputHash]));

    expect(new Set(byStream.values()).size).toBe(byStream.size);
  });
});
