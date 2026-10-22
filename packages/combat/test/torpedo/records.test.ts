import { describe, expect, it } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  computeTorpedoRecordHash,
  makeTorpedoRecord,
  torpedoRecordId,
  verifyTorpedoRecordHash,
  TORPEDO_RECORD_KINDS,
  type TorpedoRecord,
  type TorpedoRecordBody,
} from "@bluewave/combat/torpedoes";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION } from "@bluewave/combat/torpedoes";
import { resolveTorpedoes } from "@bluewave/combat/torpedoes";
import {
  buildTorpedoScene,
  torpedoContext,
  torpedoLaunchCommand,
  torpedoTargetContext,
  TORPEDO_BATTLE_ID,
} from "./advance.test.js";

function recordBody(partial: Partial<TorpedoRecordBody> = {}): TorpedoRecordBody {
  return {
    recordId: torpedoRecordId({
      battleId: "b9",
      minute: 2,
      substep: 56,
      kind: "HIT_RESOLUTION",
      sourceId: "b9:2:4:torpedo:LCH-1:tube0",
      targetId: "b9:d1",
    }),
    kind: "HIT_RESOLUTION",
    battleMinute: 2,
    substep: 56,
    sourceId: "b9:2:4:torpedo:LCH-1:tube0",
    targetId: "b9:d1",
    commandSource: "CENTRAL",
    legalContactId: "b9:d1",
    torpedoModelId: "rn_21in_mk_iv_1916",
    launcherId: "LCH-1",
    settingId: "35kn",
    solutionInputs: [
      { key: "orderedSpeedKnotsBp", value: 35_000 },
      { key: "orderedRangeM", value: 7_315 },
      { key: "orderedGyroAngleMdeg", value: 0 },
      { key: "depthSettingM", value: 4 },
    ],
    solutionQualityBp: 8_000,
    speedLimitValidation: {
      applicable: true,
      allowed: true,
      reasonCode: null,
      limitUmS: 12_861_100,
    },
    ammunitionChange: {
      tubeId: 0,
      torpedoModelId: "rn_21in_mk_iv_1916",
      before: "LOADED",
      after: "EMPTY",
    },
    rngDecision: {
      streamId: "battle/ship/torpedo/launch_failure:b9:2:4:LCH-1:tube0",
      draw: 0.1234,
      drawBp: 1_234,
    },
    damageEffects: {
      structuralDamage: 0,
      flotationDamage: 0,
      floodingSourcesCreated: 0,
      terminalTransition: null,
      reasonCode: null,
    },
    persists: false,
    formulaVersion: TORPEDO_FORMULA_VERSION,
    rulesetVersion: TORPEDO_RULESET_VERSION,
    ...partial,
  };
}

describe("AC-20 — §27 record surface + envelope hash", () => {
  it("every §27 kind constructs with the full field groups", () => {
    for (const kind of TORPEDO_RECORD_KINDS) {
      const body = recordBody({ kind, recordId: recordBody().recordId.replace("LAUNCH", kind) });
      const rec = makeTorpedoRecord(body);
      expect(rec.kind).toBe(kind);
      expect(rec.recordHash).toMatch(/^[0-9a-f]{64}$/);
      expect(rec.formulaVersion).toBe(TORPEDO_FORMULA_VERSION);
      expect(rec.rulesetVersion).toBe(TORPEDO_RULESET_VERSION);
    }
  });

  it("records are immutable (deeply frozen) after construction", () => {
    const rec = makeTorpedoRecord(recordBody());
    expect(Object.isFrozen(rec)).toBe(true);
    expect(Object.isFrozen(rec.speedLimitValidation)).toBe(true);
    expect(Object.isFrozen(rec.solutionInputs)).toBe(true);
  });

  it("the record hash is a deterministic envelope over the body fields only", () => {
    const body = recordBody();
    const rec = makeTorpedoRecord(body);
    expect(rec.recordHash).toBe(computeTorpedoRecordHash(body));
    const drifted = makeTorpedoRecord(recordBody({ solutionQualityBp: 7_999 }));
    expect(drifted.recordHash).not.toBe(rec.recordHash);
  });

  it("verifyTorpedoRecordHash rejects a tampered record", () => {
    const rec = makeTorpedoRecord(recordBody());
    expect(verifyTorpedoRecordHash(rec)).toBe(true);
    const { recordHash: _h, ...body } = rec;
    expect(computeTorpedoRecordHash(body)).toBe(rec.recordHash);
    const tampered = { ...rec, targetId: "b9:d2" } as TorpedoRecord;
    expect(tampered.recordHash).not.toBe(computeTorpedoRecordHash(tampered));
    expect(verifyTorpedoRecordHash(tampered)).toBe(false);
  });

  it("deterministic ids: same identity fields → same id, differing field → different", () => {
    const a = torpedoRecordId({
      battleId: "b1",
      minute: 1,
      substep: 4,
      kind: "LAUNCH",
      sourceId: "s",
      targetId: "t",
    });
    const b = torpedoRecordId({
      battleId: "b1",
      minute: 1,
      substep: 4,
      kind: "LAUNCH",
      sourceId: "s",
      targetId: "t",
    });
    const c = torpedoRecordId({
      battleId: "b1",
      minute: 1,
      substep: 4,
      kind: "TRACK",
      sourceId: "s",
      targetId: "t",
    });
    const d = torpedoRecordId({
      battleId: "b1",
      minute: 2,
      substep: 4,
      kind: "LAUNCH",
      sourceId: "s",
      targetId: "t",
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it("a stage-emitted LAUNCH record carries the §27 audit groups", () => {
    const context = torpedoContext({ commands: [torpedoLaunchCommand(0)] });
    const res = resolveTorpedoes({
      battleId: TORPEDO_BATTLE_ID,
      minute: 1,
      context,
      contacts: [buildTorpedoScene().contact],
      shipPositions: { a1: [0, 5_000_000_000] },
      shipHeadings: { a1: 0 },
      shipSpeedsUmS: { a1: 0 },
      engine: new RandomEngine("records-stage-seed"),
    });
    const launch = res.records.find((r) => r.kind === "LAUNCH")!;
    expect(launch).toBeDefined();
    expect(launch.battleMinute).toBe(1);
    expect(launch.sourceId).toBe("a1:LCH-1");
    expect(launch.targetId).toBe("tube0000");
    expect(launch.launcherId).toBe("LCH-1");
    expect(launch.torpedoModelId).toBe("rn_21in_mk_iv_1916");
    expect(launch.settingId).toBe("35kn");
    expect(launch.solutionQualityBp).toBe(8_000);
    expect(launch.solutionInputs.length).toBe(4);
    expect(launch.speedLimitValidation.applicable).toBe(true);
    expect(launch.ammunitionChange).not.toBeNull();
    expect(launch.ammunitionChange!.before).toBe("LOADED");
    expect(launch.ammunitionChange!.after).toBe("EMPTY");
    expect(launch.rngDecision).not.toBeNull();
    expect(launch.rngDecision!.streamId).toContain("launch_failure");
    expect(launch.persists).toBe(false);
    expect(verifyTorpedoRecordHash(launch)).toBe(true);
  });

  it("BLOCKER-1 — a severe §21 tube hit that detonates a §22 chain emits UNIQUE recordIds and eventIds", () => {
    const chainTarget = torpedoTargetContext({
      zone: "TUBE_BAY",
      tubeHazard: {
        launcherId: "LCH-1",
        propulsionType: "COMPRESSED_AIR",
        loadedCount: 3,
        loadedChecks: [
          { tubeIndex: 0, torpedoModelId: "rn_21in_mk_iv_1916" },
          { tubeIndex: 1, torpedoModelId: "rn_21in_mk_iv_1916" },
          { tubeIndex: 3, torpedoModelId: "rn_21in_mk_iv_1916" },
        ],
        isolationState: "INTACT",
        protectionLevel: "STANDARD",
        crewAtRisk: 100,
        shockCandidates: [{ stableSystemId: "DIRECTOR-1", band: "PRIMARY" }],
        targetCompartmentId: "MACHINERY",
      },
    });
    const forcedChainEngine = {
      masterSeed: "",
      stream: (domain: string) => ({
        id: domain,
        next: () => (domain.includes("launch_failure") ? 0.9999 : 0.0),
      }),
    } as unknown as RandomEngine;
    const { contact } = buildTorpedoScene();
    const res = resolveTorpedoes({
      battleId: TORPEDO_BATTLE_ID,
      minute: 1,
      context: torpedoContext({
        commands: [torpedoLaunchCommand(0)],
        targets: { d1: chainTarget },
      }),
      contacts: [contact],
      shipPositions: { a1: [0, 5_000_000_000] },
      shipHeadings: { a1: 0 },
      shipSpeedsUmS: { a1: 0 },
      engine: forcedChainEngine,
    });
    expect(res.records.some((r) => r.kind === "CHAIN_REACTION")).toBe(true);
    const damageCount = res.records.filter((r) => r.kind === "DAMAGE").length;
    expect(damageCount).toBe(2);
    const recordIds = res.records.map((r) => r.recordId);
    expect(new Set(recordIds).size).toBe(recordIds.length);
    const eventIds = res.events.map((e) => e.eventId);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    const damageRecordIds = res.records.filter((r) => r.kind === "DAMAGE").map((r) => r.recordId);
    expect(damageRecordIds.some((id) => id.includes(":chain"))).toBe(true);
  });

  it("MEDIUM-6 — machinery/shock draws are evaluated ONCE on the canonical keyed streams", () => {
    const machineryShockTarget = torpedoTargetContext({
      zone: "MACHINERY",
      machinery: { zone: "MACHINERY", machineryComponents: ["ENGINE-1", "ENGINE-2"] },
      shockCandidates: [{ stableSystemId: "DIRECTOR-1", band: "PRIMARY" }],
    });
    const { contact } = buildTorpedoScene();
    const run = () =>
      resolveTorpedoes({
        battleId: TORPEDO_BATTLE_ID,
        minute: 1,
        context: torpedoContext({
          commands: [torpedoLaunchCommand(0)],
          targets: { d1: machineryShockTarget },
        }),
        contacts: [contact],
        shipPositions: { a1: [0, 5_000_000_000] },
        shipHeadings: { a1: 0 },
        shipSpeedsUmS: { a1: 0 },
        engine: {
          masterSeed: "",
          stream: (domain: string) => ({
            id: domain,
            next: () =>
              domain.includes("launch_failure") ? 0.9999 : domain.includes("machinery") ? 0.2 : 0.0,
          }),
        } as unknown as RandomEngine,
      });
    const a = run();
    const b = run();
    expect(a.records.map((r) => r.recordId)).toEqual(b.records.map((r) => r.recordId));
    expect(a.records.map((r) => r.recordHash)).toEqual(b.records.map((r) => r.recordHash));
    const trackId = a.records.find((r) => r.kind === "TRACK")!.sourceId;
    const machinery = a.records.find((r) => r.kind === "MACHINERY")!;
    const shock = a.records.find((r) => r.kind === "SYSTEM_SHOCK")!;
    expect(machinery).toBeDefined();
    expect(shock).toBeDefined();
    expect(machinery.rngDecision!.streamId).toBe(
      `battle/torpedo/damage/machinery:${TORPEDO_BATTLE_ID}:1:56:${trackId}`,
    );
    expect(shock.rngDecision!.streamId).toBe(
      `battle/torpedo/damage/system-shock:${TORPEDO_BATTLE_ID}:1:56:${trackId}`,
    );
  });
});
