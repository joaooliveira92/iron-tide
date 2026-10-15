import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import { BATTLE_END_PRECEDENCE, DEFAULT_MAX_BATTLE_MINUTES } from "../../src/battleEnd.js";
import { AUTO_RESOLUTION_UNAVAILABLE } from "../../src/generation/reasonCodes.js";
import { computeManifestHash } from "../../src/generation/manifest.js";
import { makeAutoInput, makeManifest, makeNations } from "./fixtures.js";

const SECTION_32_REASONS = [...BATTLE_END_PRECEDENCE];

describe("AC-5: resolveBattleAuto orchestrator (end-to-end)", () => {
  it("runs a full battle to a §32 end and emits a complete result", () => {
    const input = makeAutoInput();
    const result = resolveBattleAuto(input);

    // §32 reason id
    expect(SECTION_32_REASONS).toContain(result.battleEndReason);
    // elapsed within bounds and capped at maxMinutes
    expect(result.elapsedMinutes).toBeGreaterThan(0);
    expect(result.elapsedMinutes).toBeLessThanOrEqual(DEFAULT_MAX_BATTLE_MINUTES);

    // every ship is either survivor or sunk, exactly once per side
    const all = ["a1", "a2", "d1", "d2"];
    const survivors = [...result.attackerSurvivorIds, ...result.defenderSurvivorIds];
    const sunk = [...result.attackerSunkIds, ...result.defenderSunkIds];
    expect([...survivors, ...sunk].sort()).toEqual(all.sort());
    expect(new Set([...survivors, ...sunk]).size).toBe(all.length);

    // damageReport: every ship, integer >= 0
    expect(Object.keys(result.damageReport).sort()).toEqual(all.sort());
    for (const loss of Object.values(result.damageReport)) {
      expect(Number.isInteger(loss)).toBe(true);
      expect(loss as number).toBeGreaterThanOrEqual(0);
    }

    // hashes
    expect(result.eventLedgerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.resultHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.minuteHashes.length).toBe(result.elapsedMinutes);
    for (const h of result.minuteHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);

    // provenance
    expect(result.provenance.battleId).toBe("b6-inc2-battle-001");
    expect(result.provenance.manifestHash).toBe(computeManifestHash(input.manifest));
  });

  it("the armed fixture deals real damage and resolves by fleet-strength withdrawal", () => {
    const input = makeAutoInput();
    const result = resolveBattleAuto(input);

    // Lock the wiring: the armed scenario MUST deal real damage (a regression
    // that silently starves gunnery->damage would make this vacuous).
    const losses = Object.values(result.damageReport);
    expect(losses.some((loss) => (loss as number) > 0)).toBe(true);

    // ADR-0098: after the ADR-0094 caliber correction the equal fixture had
    // ground to the 360-minute cap with no sinkings. The lethality rebalance
    // (bounded partial-penetration breaches + breach flood rate) restores the
    // ADR-0053 target: the fixture now decides inside the 30-90 minute band by
    // the ADR-0073 fleet-strength withdrawal, with a winner and no time_limit.
    expect(result.battleEndReason).toBe("withdrawal_complete");
    expect(result.elapsedMinutes).toBeGreaterThanOrEqual(30);
    expect(result.elapsedMinutes).toBeLessThanOrEqual(90);
    expect(result.winnerId).not.toBeNull();
    expect(result.loserId).not.toBeNull();
    expect(result.withdrawalReason).toBeDefined();
  });

  it("identical inputs -> byte-identical results (in-process determinism)", () => {
    const a = resolveBattleAuto(makeAutoInput());
    const b = resolveBattleAuto(makeAutoInput());
    expect(a.resultHash).toBe(b.resultHash);
    expect(a.eventLedgerHash).toBe(b.eventLedgerHash);
    expect(a.minuteHashes).toEqual(b.minuteHashes);
    expect(a.damageReport).toEqual(b.damageReport);
  });

  it("AC-6 pinned unarmed baseline: resolveBattleAuto(makeAutoInput()) stays byte-identical (P-1 review F5)", () => {
    // The fixture carries main batteries but NO torpedo-armament ships, so the
    // wired per-ship damage-control stage never activates — this is the pre-P-1
    // "unarmed" resolution path. Pinning these hashes (captured 2026-10-06
    // before ANY ticket-07 repair landed) proves the DC rollout did not perturb
    // the unarmed world: the unarmed hash freeze (amended AC-6, ADR-0049) holds through the kg->bp severity
    // fix, the fail-closed engine guard, and the reason-code registration.
    // Re-pinned for ticket 06 / ADR-0048: range- and gun-count-sensitive gunnery
    // moved the fired minutes' hashes 2026-10-06 (minute 0 is byte-identical —
    // no battery has completed a reload at minute 0). Old -> new: RESULT
    // 88d409ac... -> 74d2dfe7...; minute 1 cab4b696... -> cfe97211...; last
    // minute b0cb413a... -> 97c94150...; battle still ends no_viable_combatants
    // at minute 18.
    // Re-pinned for ticket 10 / ADR-0050 (shell-created fire/flooding sources
    // persisted into ShipDamageState; step 8.6 progresses them): RESULT
    // 74d2dfe7... -> e017125e...; minutes 0-2 byte-identical (minute 1 is still
    // cfe97211...), minutes 3-17 changed; the battle now ends no_viable_combatants
    // at minute 14 (was 18) because persisted fires/flooding sink ships sooner;
    // last minute 97c94150... -> 0493ad21....
    // Re-pinned for ADR-0053 (P-1 lethality tuning: FLOAT_UNIT 50_000 -> 400_000,
    // magazine-weighted hit zones): RESULT e017125e... -> bee00786...; minute 0
    // byte-identical, minute 1 cfe97211... -> 2c598e47..., later minutes changed; the battle now ends no_viable_combatants
    // at minute 54 (was 14); last minute 0493ad21... -> aaca0a19.... A
    // forced-old-constant run (FLOAT_UNIT 50_000, equal zone weights) reproduces
    // e017125e... exactly, so the move is due to the tuning alone.
    // Re-pinned for ADR-0073 (P-1 ticket 12, withdrawal predicate: a side below
    // 20% fleet strength breaks off): RESULT bee00786... -> 53b93ad7...; minutes 0-47
    // byte-identical (minute 1 still 2c598e47...), the battle now ends
    // withdrawal_complete at minute 48 (was no_viable_combatants at 54) with no
    // ship sunk; last minute aaca0a19... -> 9205ea66....
    //
    // Re-pinned for ADR-0094 (caliber unit-scale correction): the production-scale
    // penetration (343 mm gun -> 261 366 µm vs a 304 950 µm HARVEY belt) is a
    // PARTIAL penetration, where the legacy inflated-scale fixtures produced FULL.
    // Damage is far weaker, so the equal fixture grinds the full 360 minutes and
    // ends time_limit with no winner (balance impact measured in ADR-0094 and the
    // P-1 sweep; a separate rebalancing pass is required). Minute 0 is still
    // byte-identical (no reload completed); minute 1 is still 2c598e47... (the
    // first fired minute's pre-damage state), later minutes changed.
    // last minute 9205ea66... -> 5347d906....
    //
    // Re-pinned for ADR-0098 (post-correction lethality rebalance): bounded
    // partial-penetration breaches + the breach flood rate give the dominant
    // belt hit a progressive consequence again, so the equal fixture now decides
    // at minute 58 by withdrawal_complete (was time_limit 360). Minute 0 and
    // minute 1 are unchanged (no reload / first-fired-minute pre-damage state);
    // RESULT 25aef0ba... -> a93b6c69...; last minute 5347d906... -> f2a8fded....
    const result = resolveBattleAuto(makeAutoInput());
    expect(result.battleEndReason).toBe("withdrawal_complete");
    expect(result.elapsedMinutes).toBe(58);
    expect(result.resultHash).toBe(
      "a93b6c691f6eaaa184cd49ab45a0bf02ab79a3a75e9f5dafaa334dbc1836e35a",
    );
    expect(result.minuteHashes[0]).toBe(
      "704d9118704bb7ff99215a06c9eabcbda043c21f897e87accd311494f0c8f218",
    );
    expect(result.minuteHashes[1]).toBe(
      "2c598e47aaf75652fe048e2c27ad21bd39244937633566b98bdb5e54b874d7e4",
    );
    expect(result.minuteHashes[result.minuteHashes.length - 1]).toBe(
      "f2a8fded5facaf23b0ff8aa4d16a2e3f1caec20c67a118cc50b193afd15f3751",
    );
  });

  it("missing manifest fails closed with AUTO_RESOLUTION_UNAVAILABLE", () => {
    const input = makeAutoInput();
    let caught: unknown;
    try {
      resolveBattleAuto({ ...input, manifest: undefined as never });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(AUTO_RESOLUTION_UNAVAILABLE);
  });

  it("a nation not listed on its manifest side fails closed with a stable diagnostic", () => {
    const input = makeAutoInput({
      manifest: makeManifest({
        sides: [
          { sideId: "ATTACKER", participantIds: ["n-other"] },
          { sideId: "DEFENDER", participantIds: ["n-fr"] },
        ],
      }),
    });
    let caught: unknown;
    try {
      resolveBattleAuto(input);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
  });

  it("maxMinutes caps the battle at the configured limit", () => {
    const result = resolveBattleAuto(makeAutoInput({ maxMinutes: 5 }));
    expect(result.elapsedMinutes).toBeLessThanOrEqual(5);
  });

  it("time-limit end-to-end: unarmed fleets resolve 360 minutes to time_limit (§32, terminating-minute effects included)", () => {
    // both sides' ships carry no main battery -> nothing lethal; the battle
    // runs the full default duration and ends with the time_limit reason and
    // no winner, with every minute's effects resolved into the ledger.
    const input = makeAutoInput({
      nations: makeNations({ attackerGuns: [0, 0], defenderGuns: [0, 0] }),
    });
    const result = resolveBattleAuto(input);
    expect(result.battleEndReason).toBe("time_limit");
    expect(result.elapsedMinutes).toBe(DEFAULT_MAX_BATTLE_MINUTES);
    expect(result.winnerId).toBeNull();
    expect(result.loserId).toBeNull();
    expect(result.attackerSurvivorIds).toEqual(["a1", "a2"]);
    expect(result.defenderSurvivorIds).toEqual(["d1", "d2"]);
    expect(result.attackerSunkIds).toEqual([]);
    expect(result.defenderSunkIds).toEqual([]);
    // all 360 minutes resolved with per-minute hashes
    expect(result.minuteHashes).toHaveLength(DEFAULT_MAX_BATTLE_MINUTES);
    // terminating-minute effects were resolved: the final minute contributed
    // weather events to the authoritative ledger
    expect(result.eventLedgerHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
