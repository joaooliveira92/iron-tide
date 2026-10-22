import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import {
  BATTLE_END_PRECEDENCE,
  DEFAULT_MAX_BATTLE_MINUTES,
} from "@bluewave/combat/battleResolution";
import { AUTO_RESOLUTION_UNAVAILABLE } from "@bluewave/combat/generation";
import { computeManifestHash } from "@bluewave/combat/generation";
import { makeAutoInput, makeManifest, makeNations } from "./fixtures.js";

const SECTION_32_REASONS = [...BATTLE_END_PRECEDENCE];

describe("AC-5: resolveBattleAuto orchestrator (end-to-end)", () => {
  it("runs a full battle to a §32 end and emits a complete result", () => {
    const input = makeAutoInput();
    const result = resolveBattleAuto(input);

    expect(SECTION_32_REASONS).toContain(result.battleEndReason);
    expect(result.elapsedMinutes).toBeGreaterThan(0);
    expect(result.elapsedMinutes).toBeLessThanOrEqual(DEFAULT_MAX_BATTLE_MINUTES);

    const all = ["a1", "a2", "d1", "d2"];
    const survivors = [...result.attackerSurvivorIds, ...result.defenderSurvivorIds];
    const sunk = [...result.attackerSunkIds, ...result.defenderSunkIds];
    expect([...survivors, ...sunk].sort()).toEqual(all.sort());
    expect(new Set([...survivors, ...sunk]).size).toBe(all.length);

    expect(Object.keys(result.damageReport).sort()).toEqual(all.sort());
    for (const loss of Object.values(result.damageReport)) {
      expect(Number.isInteger(loss)).toBe(true);
      expect(loss as number).toBeGreaterThanOrEqual(0);
    }

    expect(result.eventLedgerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.resultHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.minuteHashes.length).toBe(result.elapsedMinutes);
    for (const h of result.minuteHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);

    expect(result.provenance.battleId).toBe("b6-inc2-battle-001");
    expect(result.provenance.manifestHash).toBe(computeManifestHash(input.manifest));
  });

  it("the armed fixture deals real damage and resolves by fleet-strength withdrawal", () => {
    const input = makeAutoInput();
    const result = resolveBattleAuto(input);

    const losses = Object.values(result.damageReport);
    expect(losses.some((loss) => (loss as number) > 0)).toBe(true);

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
    expect(result.minuteHashes).toHaveLength(DEFAULT_MAX_BATTLE_MINUTES);
    expect(result.eventLedgerHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
