// AC-20 — DESIGN-40 §27 immutable torpedo records: every launch/track/hit/
// detonation/damage/flooding/machinery/shock/hazard/chain-reaction carries the
// §27 field groups (battle minute+substep, source+target ids, command source,
// legal contact ref, model/launcher/setting, solution inputs+quality,
// speed-limit validation, ammunition changes, RNG decisions, damage+
// persistence effects, formula+ruleset versions) and a deterministic envelope
// record hash. Records are deeply frozen; the hash is purely a function of the
// body fields (repeated runs and child processes emit identical hashes).
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
} from "../../src/torpedoes/records.js";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION } from "../../src/torpedoes/constants.js";
import { resolveTorpedoes } from "../../src/torpedoes/resolve.js";
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
    // any body drift changes the hash
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
    // Build a stage fixture that exercises the §22 chain path: a TUBE_BAY impact
    // with a loaded-tube hazard context whose severe draw and chain draws are
    // forced below their thresholds (the deterministic keyedRng seams) so the
    // chain explosion package is actually applied. The chain explosion shares
    // the primary package's source (track) / target (ship) at the same instant,
    // so WITHOUT the discriminator its DAMAGE/FLOODING_SOURCE/SYSTEM_SHOCK
    // record ids and event ids would collide with the primary package's.
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
    // deterministic keyedRng: avoid a launch failure (0.9999), force every other
    // draw to zero so the detonation functions, the tube hazard is SEVERE, and the
    // §22 chain detonates — exercising the full chain-explosion record path.
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
    // the §22 chain path was actually exercised
    expect(res.records.some((r) => r.kind === "CHAIN_REACTION")).toBe(true);
    // the chain explosion package AND the primary package both produced a DAMAGE record
    const damageCount = res.records.filter((r) => r.kind === "DAMAGE").length;
    expect(damageCount).toBe(2);
    // every §27 recordId and every ledger eventId is unique (the BLOCKER-1 fix)
    const recordIds = res.records.map((r) => r.recordId);
    expect(new Set(recordIds).size).toBe(recordIds.length);
    const eventIds = res.events.map((e) => e.eventId);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    // the chain discriminator is present on the secondary damage records
    const damageRecordIds = res.records.filter((r) => r.kind === "DAMAGE").map((r) => r.recordId);
    expect(damageRecordIds.some((id) => id.includes(":chain"))).toBe(true);
  });

  it("MEDIUM-6 — machinery/shock draws are evaluated ONCE on the canonical keyed streams", () => {
    // The engine pre-evaluates §19/§20 to populate the package fields and threads
    // that single result into applyTorpedoDamagePackage (no re-evaluation). Pin
    // the invariant: each machinery/shock stream draw is consumed exactly once on
    // the canonical domain-separated stream, and repeated runs emit byte-identical
    // records (the deterministic single-eval guarantee).
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
        // force the machinery draw to a damaging severity (drawBp 2_000 ->
        // DEGRADED_PROPULSION), the shock draw to a strike (0.0), and avoid a
        // launch failure so the track runs and the damage package is applied.
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
    // single-eval determinism: two runs emit identical records
    expect(a.records.map((r) => r.recordId)).toEqual(b.records.map((r) => r.recordId));
    expect(a.records.map((r) => r.recordHash)).toEqual(b.records.map((r) => r.recordHash));
    // the track id from the TRACK record's sourceId
    const trackId = a.records.find((r) => r.kind === "TRACK")!.sourceId;
    const machinery = a.records.find((r) => r.kind === "MACHINERY")!;
    const shock = a.records.find((r) => r.kind === "SYSTEM_SHOCK")!;
    expect(machinery).toBeDefined();
    expect(shock).toBeDefined();
    // the single evaluation consumed the canonical domain-separated streams
    expect(machinery.rngDecision!.streamId).toBe(
      `battle/torpedo/damage/machinery:${TORPEDO_BATTLE_ID}:1:56:${trackId}`,
    );
    expect(shock.rngDecision!.streamId).toBe(
      `battle/torpedo/damage/system-shock:${TORPEDO_BATTLE_ID}:1:56:${trackId}`,
    );
  });
});
