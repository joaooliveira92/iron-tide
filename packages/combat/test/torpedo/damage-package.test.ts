// AC-15 (DESIGN-40 §16): the TorpedoDamagePackage — all §16 fields + package
// hash — applied ATOMICALLY through the tactical damage contract: the package
// factory computes the §17 flotation budget (exact shipped formula + tables)
// and the creation-only §18 progressive rate; applyTorpedoDamagePackage runs
// the reused B-4 seams (resolveStructureFlotation -> floor-at-0,
// evaluateTerminalSeam -> SINKING when the reserve is exhausted, §18 flooding
// creation, §19 machinery + §20 system-shock keyed evaluations, the optional
// §21 tube hazard) and assembles ONE authoritative state + a frozen event
// record. Proves the §17 "never exceeds the remaining reserve without a
// sinking/sunk transition" bound, the rollback invariant (a stage throw
// leaves the input state untouched), determinism, and frozen outputs.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import type { ShipDamageState } from "../../src/damage/index.js";
import {
  applyTorpedoDamagePackage,
  assertAuthoritativeTorpedoDamagePackage,
  assertTorpedoDamagePackageSurface,
  battleIdFromPackage,
  createTorpedoDamagePackage,
  TORPEDO_PROGRESSIVE_FLOODING_CREATED,
  UNDERWATER_TUBE_SEVERE_FLOODING,
  verifyTorpedoDamagePackageHash,
  type TorpedoDamagePackage,
} from "../../src/torpedoes/index.js";
import { compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";

// ---- fixture state (the B-4 shape proven by damage/state.test.ts) ----------
function baseState(overrides: Partial<ShipDamageState> = {}): ShipDamageState {
  return {
    shipId: "SHIP-TAU",
    compartments: ["ENG-ROOM-A", "ENG-ROOM-B", "TUBE-BAY-1"],
    components: ["TURRET-1", "TURRET-2", "ENGINE-1"],
    structuralIntegrity: 100_000,
    flotationReserve: 50_000,
    stabilityScore: 8_000,
    fireRecords: [],
    floodingRecords: [],
    progressiveFloodingTotal: 0,
    performanceModifiers: {},
    terminalStatus: "NORMAL",
    rulesetVersion: "damage_ruleset_v1",
    formulaVersion: "damage_formula_v1",
    stateHash: "",
    ...overrides,
  };
}

// A Type-93-scale package on a STANDARD-protected hull (MACHINERY zone).
function type93Package(battleId = "B1"): TorpedoDamagePackage {
  const model = compiledTorpedoOf("jpn_61cm_type93_1935");
  return createTorpedoDamagePackage({
    battleId,
    battleMinute: 6,
    substep: 4,
    torpedoTrackId: `${battleId}:6:4:torpedo:LCH-1:tube0`,
    targetShipId: "TARGET-SHIP",
    targetContactId: "C1",
    impactZone: "MACHINERY",
    impactSide: "PORT",
    longitudinalPositionM: 150,
    warheadExplosiveEquivalentMassKg: model.warheadExplosiveEquivalentMassKg, // 490
    detonationDepthM: 5,
    protectionLevel: "STANDARD",
    hullBreachAreaM2: 30,
    isolationState: "INTACT",
    machinery: {
      severity: "MAJOR_PROPULSION_LOSS",
      affectedComponents: ["ENGINE-1"],
      componentOutcome: "DISABLED",
    },
    nearbySystemShock: { affectedSystemId: "TURRET-1", componentOutcome: "DESTROYED" },
    fireProbabilityBp: 2_500,
    crewCasualties: 120,
    damageControlAccessibility: "RESTRICTED",
  });
}

describe("AC-15 §16: the package factory (all §16 fields + hash)", () => {
  it("builds a package with every §16 field + a deterministic package hash", () => {
    const pkg = type93Package();
    // target + impact surface
    expect(pkg.targetShipId).toBe("TARGET-SHIP");
    expect(pkg.impactZone).toBe("MACHINERY");
    expect(pkg.impactSide).toBe("PORT");
    expect(pkg.longitudinalPositionM).toBe(150);
    // warhead + geometry
    expect(pkg.warheadExplosiveEquivalentMassKg).toBe(490);
    expect(pkg.detonationDepthM).toBe(5);
    expect(pkg.protectionLevel).toBe("STANDARD");
    expect(pkg.hullBreachAreaM2).toBe(30);
    // the computed damage budget: 490 kg × 16 = 7_840 base flotation; with
    // the STANDARD leak (10_000) × MACHINERY zone (12_500) and the neutral
    // existing term: floor(7_840 × 10_000 × 12_500 × 10_000 / 10_000^3) = 9_800
    expect(Math.floor((7_840 * 10_000 * 12_500 * 10_000) / 10_000 ** 3)).toBe(9_800);
    expect(pkg.flotationDamage).toBe(9_800);
    expect(pkg.structuralDamage).toBe(490 * 48); // 23_520 (BALANCE TARGET rate)
    expect(pkg.immediateFloodingKg).toBeGreaterThan(0); // breach-volume estimate
    expect(pkg.progressiveFloodingRateKgMin).toBe(15_000); // 30 m² × 1_000 × INTACT 5_000 ÷ 10_000
    // the resolved machinery/shock/fire/casualty/damage-control inputs
    expect(pkg.machinery.severity).toBe("MAJOR_PROPULSION_LOSS");
    expect(pkg.nearbySystemShock.affectedSystemId).toBe("TURRET-1");
    expect(pkg.fireProbabilityBp).toBe(2_500);
    expect(pkg.crewCasualties).toBe(120);
    expect(pkg.damageControlAccessibility).toBe("RESTRICTED");
    // the authoritative hash
    expect(pkg.packageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => assertAuthoritativeTorpedoDamagePackage(pkg)).not.toThrow();
    expect(verifyTorpedoDamagePackageHash(pkg)).toBe(true);
    expect(Object.isFrozen(pkg)).toBe(true);
  });

  it("recomputes the package hash over the full non-hash surface (tamper-proof)", () => {
    const pkg = type93Package();
    const tampered = { ...pkg, flotationDamage: pkg.flotationDamage + 1 };
    expect(verifyTorpedoDamagePackageHash(tampered)).toBe(false);
  });

  it("rejects malformed package bodies (fail closed)", () => {
    expect(() => assertTorpedoDamagePackageSurface(null as never)).toThrow(BluewaveError);
    expect(() =>
      createTorpedoDamagePackage({
        battleId: "", // invalid battle id -> fail closed at the factory
        battleMinute: 6,
        substep: 4,
        torpedoTrackId: "not-there",
        targetShipId: "SHIP",
        targetContactId: "C",
        impactZone: "MACHINERY",
        impactSide: "PORT",
        longitudinalPositionM: 10,
        warheadExplosiveEquivalentMassKg: 100,
        detonationDepthM: 5,
        protectionLevel: "STANDARD",
        hullBreachAreaM2: 10,
        isolationState: "INTACT",
        machinery: {
          severity: "NO_EFFECT",
          affectedComponents: [],
          componentOutcome: "UNAFFECTED",
        },
        nearbySystemShock: { affectedSystemId: null, componentOutcome: null },
        fireProbabilityBp: 200,
        crewCasualties: 0,
        damageControlAccessibility: "ACCESSIBLE",
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-15/AC-16: atomic application through the tactical damage contract", () => {
  it("applies structure/flotation + creates flooding sources + no terminal transition on a survivable hit", () => {
    const state = baseState(); // reserve 50_000 — the Type-93 budget stays afloat
    const pkg = type93Package();
    const result = applyTorpedoDamagePackage({
      state,
      pkg,
      flooding: [
        { compartmentId: "ENG-ROOM-A", baseBreachRateKgMin: 30_000, isolationState: "INTACT" },
      ],
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: () => 0.9, // unused on this scene (no machinery/shock ctx)
    });
    // structure/flotation applied through the reused seam (floor-at-0)
    expect(result.newState.structuralIntegrity).toBe(100_000 - 23_520);
    expect(result.newState.flotationReserve).toBe(50_000 - 9_800);
    expect(result.newState.progressiveFloodingTotal).toBe(0); // creation does NOT tick
    expect(result.createdFloodingSources).toEqual([
      {
        compartmentId: "ENG-ROOM-A",
        rateKgMin: 15_000,
        cause: TORPEDO_PROGRESSIVE_FLOODING_CREATED,
      },
    ]);
    expect(result.newState.floodingRecords).toHaveLength(1);
    expect(result.newState.floodingRecords[0].cause).toBe(TORPEDO_PROGRESSIVE_FLOODING_CREATED);
    expect(result.newState.terminalStatus).toBe("NORMAL");
    expect(result.terminalResult.transition).toBe("NONE");
    expect(result.eventRecord.terminalTransition).toBeNull();
    expect(result.eventRecord.recordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.newState.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(result.newState)).toBe(true);
  });

  it("an exhaustive hit transitions to SINKING — the §17 never-exceeds-reserve bound", () => {
    const state = baseState({ flotationReserve: 2_000 }); // smaller than 9_800
    const result = applyTorpedoDamagePackage({
      state,
      pkg: type93Package(),
      flooding: [],
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: () => 0.9,
    });
    expect(result.structureFlotation.flotationReserveAfter).toBe(0);
    expect(result.newState.flotationReserve).toBe(0);
    expect(result.terminalResult.transition).toBe("SINKING");
    expect(result.newState.terminalStatus).toBe("SINKING");
    expect(result.eventRecord.terminalTransition).toBe("SINKING");
  });

  it("reserve 0 + structure 0 -> FOUNDERED (both seams fire)", () => {
    const state = baseState({ flotationReserve: 1_000, structuralIntegrity: 100 });
    const result = applyTorpedoDamagePackage({
      state,
      pkg: type93Package(),
      flooding: [],
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: () => 0.9,
    });
    // 100 - 23_520 <= 0 AND 1_000 - 9_800 <= 0 -> FOUNDERED
    expect(result.structureFlotation.structuralIntegrityAfter).toBe(0);
    expect(result.terminalResult.transition).toBe("FOUNDERED");
    expect(result.newState.terminalStatus).toBe("FOUNDERED");
  });

  it("the machinery + system-shock draws run in the documented order", () => {
    const calls: string[] = [];
    const result = applyTorpedoDamagePackage({
      state: baseState(),
      pkg: type93Package(),
      flooding: [],
      machinery: { zone: "MACHINERY", machineryComponents: ["ENGINE-1"] },
      shockCandidates: [{ stableSystemId: "TURRET-1", band: "PRIMARY" }],
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: (stream) => {
        calls.push(stream);
        return 0.5;
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^battle\/torpedo\/damage\/machinery:/);
    expect(calls[1]).toMatch(/^battle\/torpedo\/damage\/system-shock:/);
    expect(result.machineryEffect).not.toBeNull();
    expect(result.systemShockResult).not.toBeNull();
    // a machinery-space hit at drawBp 5_000 selects MAJOR_PROPULSION_LOSS
    expect(result.machineryEffect!.severity).toBe("MAJOR_PROPULSION_LOSS");
  });

  it("an incomplete scene (missing required tube-hazard param) fails closed", () => {
    const pkg = type93Package();
    expect(() =>
      applyTorpedoDamagePackage({
        state: baseState(),
        pkg,
        flooding: [],
        tubeHazard: {
          launcherId: "LCH-1",
          propulsionType: "WET_HEATER" as never, // valid propulsion; isolation left off
          loadedCount: 2,
          loadedChecks: [],
          isolationState: undefined as never,
          protectionLevel: "NONE",
          crewAtRisk: 100,
          shockCandidates: [],
          targetCompartmentId: "TUBE-BAY-1",
        },
        designFlotationReserve: 50_000,
        designStabilityScore: 8_000,
        keyedRng: () => 0.001,
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-15/AC-18: tube-hazard + §22 chain integration inside the atomic path", () => {
  it("a severe tube-bay hazard layers the extra source + launcher DESTROYED and REDUCES the flotation reserve (§21 = §16/§17 immediate flotation loss)", () => {
    const pkg = createTorpedoDamagePackage({
      battleId: "B1",
      battleMinute: 6,
      substep: 4,
      torpedoTrackId: "B1:6:4:torpedo:LCH-1:tube0",
      targetShipId: "TARGET-SHIP",
      targetContactId: "C1",
      impactZone: "TUBE_BAY",
      impactSide: "PORT",
      longitudinalPositionM: 120,
      warheadExplosiveEquivalentMassKg: 280,
      detonationDepthM: 5,
      protectionLevel: "STANDARD",
      hullBreachAreaM2: 20,
      isolationState: "INTACT",
      machinery: { severity: "NO_EFFECT", affectedComponents: [], componentOutcome: "UNAFFECTED" },
      nearbySystemShock: { affectedSystemId: null, componentOutcome: null },
      fireProbabilityBp: 1_000,
      crewCasualties: 0,
      damageControlAccessibility: "ACCESSIBLE",
    });
    const result = applyTorpedoDamagePackage({
      state: baseState(),
      pkg,
      flooding: [],
      tubeHazard: {
        launcherId: "LCH-1",
        propulsionType: "WET_HEATER",
        loadedCount: 2,
        loadedChecks: [
          { tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" },
          { tubeIndex: 1, torpedoModelId: "ger_533mm_g7e_1936" },
        ],
        isolationState: "DEGRADED",
        protectionLevel: "NONE",
        crewAtRisk: 100,
        shockCandidates: [{ stableSystemId: "STEERING-1", band: "SECONDARY" }],
        targetCompartmentId: "TUBE-BAY-1",
      },
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: () => 0.001, // severe hazard + casualty strike
    });
    expect(result.tubeHazardResult?.severe).toBe(true);
    expect(result.tubeHazardResult?.reasonCode).toBe(UNDERWATER_TUBE_SEVERE_FLOODING);
    expect(result.tubeHazardResult?.launcherDamageState).toBe("DESTROYED");
    expect(result.tubeHazardResult?.chainChecks).toHaveLength(2);
    expect(
      result.newState.floodingRecords.some((s) => s.cause === UNDERWATER_TUBE_SEVERE_FLOODING),
    ).toBe(true);
    // §17 flotation damage already reduced the reserve to 50_000 - 5_600 = 44_400.
    expect(result.structureFlotation.flotationReserveAfter).toBe(44_400);
    // the §21 severe immediate flooding is FLOTATION-RESERVE loss (§16/§17
    // semantics): 5_000 bp of the remaining reserve = floor(44_400 × 0.5) =
    // 22_200, so the final reserve falls to 44_400 - 22_200 = 22_200.
    expect(result.tubeHazardResult!.immediateAdditionalFloodingKg).toBe(22_200);
    expect(result.newState.flotationReserve).toBe(22_200);
    expect(result.newState.flotationReserve).toBeLessThan(
      result.structureFlotation.flotationReserveAfter,
    );
    // the §21 immediate burst is NOT a progressive total (the 15_000 bp extra
    // source is the separate C-5 progressive source — recorded as a source, not
    // accumulated into progressiveFloodingTotal).
    expect(result.newState.progressiveFloodingTotal).toBe(0);
    expect(result.terminalResult.transition).toBe("NONE"); // 22_200 > 0 stays afloat
  });

  it("a small reserve after §17 — the §21 severe flooding reduces the reserve toward the SINKING boundary (floor-at-0, terminal seam sees the reduced reserve)", () => {
    // TUBE_BAY pkg flotation = 5_600; pick a reserve that leaves only 2 after §17
    // (NOT sunk by §17), then the §21 severe burst (5_000 bp → 1 kg) drops it to
    // 1 — one unit above the SINKING boundary, proving the reserve reduction
    // flows through the terminal seam.
    const pkg = createTorpedoDamagePackage({
      battleId: "B1",
      battleMinute: 6,
      substep: 4,
      torpedoTrackId: "B1:6:4:torpedo:LCH-1:tube0",
      targetShipId: "TARGET-SHIP",
      targetContactId: "C1",
      impactZone: "TUBE_BAY",
      impactSide: "PORT",
      longitudinalPositionM: 120,
      warheadExplosiveEquivalentMassKg: 280,
      detonationDepthM: 5,
      protectionLevel: "STANDARD",
      hullBreachAreaM2: 20,
      isolationState: "INTACT",
      machinery: { severity: "NO_EFFECT", affectedComponents: [], componentOutcome: "UNAFFECTED" },
      nearbySystemShock: { affectedSystemId: null, componentOutcome: null },
      fireProbabilityBp: 1_000,
      crewCasualties: 0,
      damageControlAccessibility: "ACCESSIBLE",
    });
    const result = applyTorpedoDamagePackage({
      state: baseState({ flotationReserve: 5_602 }), // 5_602 - 5_600 = 2 after §17
      pkg,
      flooding: [],
      tubeHazard: {
        launcherId: "LCH-1",
        propulsionType: "WET_HEATER",
        loadedCount: 2,
        loadedChecks: [],
        isolationState: "DEGRADED",
        protectionLevel: "NONE",
        crewAtRisk: 0,
        shockCandidates: [],
        targetCompartmentId: "TUBE-BAY-1",
      },
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: () => 0.001, // severe hazard
    });
    expect(result.structureFlotation.flotationReserveAfter).toBe(2); // §17 only
    expect(result.tubeHazardResult?.immediateAdditionalFloodingKg).toBe(1); // floor(2×0.5)
    expect(result.newState.flotationReserve).toBe(1); // reduced, not sunk
    expect(result.terminalResult.transition).toBe("NONE"); // 1 > 0 — just above SINKING
    expect(
      result.newState.floodingRecords.some((s) => s.cause === UNDERWATER_TUBE_SEVERE_FLOODING),
    ).toBe(true);
  });
});

describe("AC-15: rollback invariant + determinism", () => {
  it("a stage throw leaves the input state untouched (no partial mutation)", () => {
    const state = baseState();
    const snapshot = JSON.parse(JSON.stringify(state));
    expect(() =>
      applyTorpedoDamagePackage({
        state,
        pkg: type93Package(),
        flooding: [{ compartmentId: "X", baseBreachRateKgMin: -5 }] as never,
        designFlotationReserve: 50_000,
        designStabilityScore: 8_000,
        keyedRng: () => 0.5,
      }),
    ).toThrow(BluewaveError);
    expect(state).toEqual(snapshot); // the input object was never touched
  });

  it("identical inputs + identical keyed draws -> identical frozen results", () => {
    const run = () =>
      applyTorpedoDamagePackage({
        state: baseState(),
        pkg: type93Package(),
        flooding: [],
        machinery: { zone: "MACHINERY", machineryComponents: ["ENGINE-1"] },
        shockCandidates: [],
        designFlotationReserve: 50_000,
        designStabilityScore: 8_000,
        keyedRng: () => 0.777,
      });
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(a.newState.stateHash).toBe(b.newState.stateHash);
  });

  it("the package/battle id embeds the battle deterministically", () => {
    expect(battleIdFromPackage("B1:6:4:torpedo-damage:t")).toBe("B1");
    expect(() => battleIdFromPackage("not-well-formed")).toThrow(BluewaveError);
  });
});
