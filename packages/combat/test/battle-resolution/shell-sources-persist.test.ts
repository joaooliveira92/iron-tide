import { describe, expect, it } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import type { TacticalContact } from "@bluewave/combat/contact";
import {
  initialDamageState,
  persistCreatedSources,
  resolveMinuteDamage,
  type DamageContext,
  type DamageTargetContext,
} from "@bluewave/combat/battleResolution";
import { autoZonesForBelt } from "@bluewave/combat/battleResolution";
import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { createDefaultDamageControlResource } from "@bluewave/combat/damage";
import type { DamageControlContext } from "@bluewave/combat/damage";
import { withDamageStateHash } from "@bluewave/combat/damage";
import { buildTestState } from "../simulation/advance.test.js";
import { makeGunneryHitRecord } from "./damage-hit.js";
import { makeAutoInput, makeNations } from "./fixtures.js";

const OBSERVATION_TIME = "1900-01-01T00:00:00.000Z";
const HULL_KG = 30_000_000;

function contact(contactId: string, assetId: string): TacticalContact {
  return {
    contactId,
    battleId: "b1",
    assetId,
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: [10_000_000_000, 5_000_000_000],
    course: 270,
    speed: 10_000,
    confidence: 10_000,
    observationTime: "1880-06-15T06:00:00.000Z",
    source: "visual",
    uncertainty: 0,
    lastUpdateMinute: 1,
    stale: false,
    sources: ["visual"],
  };
}

function target(shipId: string): DamageTargetContext {
  return {
    shipId,
    zones: autoZonesForBelt(152_000),
    compartments: ["COMP-BELT-1"],
    components: ["TURRET-1", "ENGINE-1"],
    state: initialDamageState(shipId),
    designFlotationReserve: 50_000,
    designStabilityScore: 8_000,
    designDisplacementKg: HULL_KG,
    beltArmorUm: 152_000,
    mainGunsCaliberUm: 343_000,
    shipType: "BB",
    maxHitPoints: 100,
  };
}

function dcContext(shipId: string): DamageControlContext {
  return {
    shipId,
    fireRecords: [],
    floodingRecords: [],
    floodedWaterBp: 0,
    designDisplacementKg: HULL_KG,
    shipType: "BB",
    currentSpeedKt: 10,
    resources: createDefaultDamageControlResource(),
    keyedRng: null,
  };
}

describe("persistCreatedSources", () => {
  const base = initialDamageState("d1");

  it("returns the identical state object (same hash) when nothing was created", () => {
    expect(persistCreatedSources(base, [])).toBe(base);
    expect(
      persistCreatedSources(base, [{ createdFireSources: [], createdFloodingSources: [] }]),
    ).toBe(base);
  });

  it("appends flooding verbatim, merges same-location fires at the higher intensity, rehashes", () => {
    const out = persistCreatedSources(base, [
      {
        createdFireSources: [
          { locationId: "BELT", intensityBp: 3_000, cause: "FIRE_SOURCE_CREATED" },
        ],
        createdFloodingSources: [
          { compartmentId: "BELT", rateKgMin: 500, cause: "FLOODING_SOURCE_CREATED" },
        ],
      },
      {
        createdFireSources: [
          { locationId: "BELT", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" },
        ],
        createdFloodingSources: [
          { compartmentId: "BELT", rateKgMin: 700, cause: "FLOODING_SOURCE_CREATED" },
        ],
      },
    ]);
    expect(out.fireRecords).toEqual([
      { locationId: "BELT", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" },
    ]);
    expect(out.floodingRecords.map((f) => f.rateKgMin)).toEqual([500, 700]);
    expect(out.stateHash).not.toBe(base.stateHash);
    expect(out.stateHash).toBe(withDamageStateHash({ ...out }).stateHash);
    expect(base.fireRecords).toHaveLength(0);
  });
});

describe("shell-started fire persists and progresses (unarmed gunnery-only path)", () => {
  function hit() {
    return resolveMinuteDamage({
      battleId: "b1",
      minute: 1,
      salvos: [makeGunneryHitRecord({ batteryId: "a1:MAIN", targetContactId: "b1:d1" })],
      contacts: [contact("b1:d1", "d1")],
      targets: { d1: target("d1") },
      engine: new RandomEngine("seed-ticket-10"),
    });
  }

  it("a shell hit that creates a fire lands it in ShipDamageState.fireRecords", () => {
    const out = hit();
    const state = out.states["d1"]!;
    const eventFires = state.fireRecords;
    expect(eventFires.length).toBeGreaterThan(0);
    expect(eventFires.every((f) => Number.isInteger(f.intensityBp))).toBe(true);
    expect(hit().states["d1"]!.stateHash).toBe(state.stateHash);
  });

  it("the persisted fire progresses across minutes through engine step 8.6", () => {
    const damaged = hit().states["d1"]!;
    const fire = damaged.fireRecords[0]!;
    const targets: DamageContext["targets"] = {
      d1: { ...target("d1"), state: damaged },
      a1: target("a1"),
    };
    const run = () =>
      advanceMinutes({
        state: buildTestState(),
        minutes: 4,
        observationTime: OBSERVATION_TIME,
        damage: { battleId: "b1", targets },
        damageControl: {
          d1: {
            ...dcContext("d1"),
            fireRecords: [...damaged.fireRecords],
            floodingRecords: [...damaged.floodingRecords],
            floodedWaterBp: damaged.progressiveFloodingTotal,
          },
          a1: dcContext("a1"),
        },
      });
    const res = run();
    const intensities = res.results.map(
      (r) =>
        r.damageStates?.["d1"]?.fireRecords.find((f) => f.locationId === fire.locationId)
          ?.intensityBp,
    );
    expect(intensities.every((i) => i !== undefined)).toBe(true);
    expect(intensities[0]!).toBeLessThan(fire.intensityBp);
    for (let i = 1; i < intensities.length; i++) {
      expect(intensities[i]!).toBeLessThanOrEqual(intensities[i - 1]!);
    }
    for (const r of res.results) expect(r.damageStates?.["a1"]).toBeUndefined();
    expect(run().hashes).toEqual(res.hashes);
  });
});

describe("engine-level: a seeded FireRecord progresses without any gunnery", () => {
  it("decays 8_000 -> 7_800 -> ... bp minute over minute, deterministically", () => {
    const seeded = withDamageStateHash({
      ...initialDamageState("d1"),
      fireRecords: [{ locationId: "COMP-BELT-1", intensityBp: 8_000, cause: "seed" }],
    });
    const run = () =>
      advanceMinutes({
        state: buildTestState(),
        minutes: 3,
        observationTime: OBSERVATION_TIME,
        damage: { battleId: "b1", targets: { d1: { ...target("d1"), state: seeded } } },
        damageControl: {
          d1: { ...dcContext("d1"), fireRecords: [...seeded.fireRecords] },
        },
      });
    const res = run();
    const seq = res.results.map((r) => r.damageStates?.["d1"]?.fireRecords[0]?.intensityBp);
    expect(seq[0]).toBe(7_800);
    expect(seq[1]!).toBeLessThan(seq[0]!);
    expect(seq[2]!).toBeLessThanOrEqual(seq[1]!);
    expect(run().hashes).toEqual(res.hashes);
  });
});

describe("§32 battle-end decision with persisted sources", () => {
  const seeds = ["fid-a", "fid-b", "fid-c", "fid-d", "fid-e"];
  it("every unarmed battle ends by one side breaking off, with persisted sources deterministic", () => {
    for (const seed of seeds) {
      const r = resolveBattleAuto({
        ...makeAutoInput({ nations: makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] }) }),
        campaignSeed: seed,
      });
      expect(["withdrawal_complete", "mutual_disengagement", "time_limit"]).toContain(
        r.battleEndReason,
      );
      expect(r.attackerSurvivorIds.length).toBeGreaterThan(0);
      expect(r.defenderSurvivorIds.length).toBeGreaterThan(0);
      const again = resolveBattleAuto({
        ...makeAutoInput({ nations: makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] }) }),
        campaignSeed: seed,
      });
      expect(again.resultHash).toBe(r.resultHash);
    }
  });
});
