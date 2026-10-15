import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import type { TacticalContact } from "../../src/contact/lifecycle.js";
import {
  battleLoss,
  hpOfState,
  initialDamageState,
  resolveMinuteDamage,
  shellPenetrationUm,
  synthesizeImpact,
  type DamageTargetContext,
} from "../../src/battleResolution/damage.js";
import type { ShipDamageState } from "../../src/damage/state.js";
import { autoZonesForBelt } from "../../src/battleResolution/constants.js";
import { makeGunneryHitRecord } from "./damage-hit.js";

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
    zones: autoZonesForBelt(305_000),
    compartments: ["COMP-BELT-1"],
    components: ["TURRET-1", "ENGINE-1"],
    state: initialDamageState(shipId),
    designFlotationReserve: 50_000,
    designStabilityScore: 8_000,
    // 30 000 t design displacement; severity of flooding converts kg -> bp
    // against this denominator (ADR-0047 decision 4).
    designDisplacementKg: 30_000_000,
    beltArmorUm: 305_000,
    mainGunsCaliberUm: 343_000,
    shipType: "BB",
    maxHitPoints: 100,
  };
}

describe("AC: damage flow — HIT -> GunneryImpact -> resolveDamage -> damageReport", () => {
  it("a HIT salvo synthesizes an impact that reduces structure/flotation", () => {
    const state = initialDamageState("d1");
    const salvo = makeGunneryHitRecord({ batteryId: "a1:MAIN", targetContactId: "b1:d1" });
    const zone = autoZonesForBelt(305_000)[0]!; // BELT

    const impact = synthesizeImpact({
      salvo,
      targetShipId: "d1",
      zone,
      beltArmorUm: 305_000,
      mainGunsCaliberUm: 343_000,
      shipType: "BB",
    });

    expect(impact.targetShipId).toBe("d1");
    expect(impact.hitLocation).toBe("BELT");
    expect(impact.structuralDamage).toBeGreaterThan(0);

    const out = resolveMinuteDamage({
      battleId: "b1",
      minute: 5,
      salvos: [salvo],
      contacts: [contact("b1:d1", "d1")],
      targets: { d1: target("d1") },
      engine: new RandomEngine("seed-damage-flow"),
    });

    expect(out.states["d1"]).toBeDefined();
    const ns = out.states["d1"]!;
    expect(ns.structuralIntegrity).toBeLessThanOrEqual(state.structuralIntegrity);
    expect(ns.structuralIntegrity).toBeGreaterThanOrEqual(0);
    expect(ns.flotationReserve).toBeLessThanOrEqual(state.flotationReserve);
    expect(out.events.length).toBeGreaterThan(0);
    expect(out.events[0]!.eventType).toBe("damage_impact");

    // structural loss is reflected in the damageReport mapping (integer >= 0)
    const loss = battleLoss(100, ns, 100) as number;
    expect(loss).toBeGreaterThan(0);
    expect(Number.isInteger(loss)).toBe(true);
  });

  it("same input twice -> identical resulting damage (deterministic)", () => {
    const salvo = makeGunneryHitRecord({ batteryId: "a1:MAIN", targetContactId: "b1:d1" });
    const input = () => ({
      battleId: "b1",
      minute: 3,
      salvos: [salvo],
      contacts: [contact("b1:d1", "d1")],
      targets: { d1: target("d1") },
      engine: new RandomEngine("seed-x"),
    });

    const a = resolveMinuteDamage(input());
    const b = resolveMinuteDamage(input());

    // same start state + same seed + same target -> identical resulting states
    expect(a.states["d1"]!.structuralIntegrity).toBe(b.states["d1"]!.structuralIntegrity);
    expect(a.states["d1"]!.flotationReserve).toBe(b.states["d1"]!.flotationReserve);
    expect(a.events).toHaveLength(b.events.length);
  });

  it("distinct targets draw zones from distinct keyed streams (domain separation)", () => {
    // F1/ADR-0026: the hit-zone stream is keyed by target AND salvo battery, so
    // two ships hit in the same minute never draw from the same stream. Repeat
    // many times to show the two target keys are not correlated streams.
    const salvo1 = makeGunneryHitRecord({ batteryId: "a1:MAIN", targetContactId: "b1:d1" });
    const salvo2 = makeGunneryHitRecord({ batteryId: "a2:MAIN", targetContactId: "b1:d2" });

    // d1 and d2 are hit in the same minute/battle: their zones must NOT be
    // forced to be identical (that would prove the stream-key bug). At least
    // one structural difference over several repeated runs is expected, but the
    // strong invariant is that per-target streams yield independent draws —
    // verify the two first-zone draws differ across enough repeats.
    let differed = 0;
    for (let i = 0; i < 20; i++) {
      const engine = new RandomEngine(`seed-${i}`);
      const ra = resolveMinuteDamage({
        battleId: "b1",
        minute: 3,
        salvos: [salvo1],
        contacts: [contact("b1:d1", "d1")],
        targets: { d1: target("d1") },
        engine,
      });
      const rb = resolveMinuteDamage({
        battleId: "b1",
        minute: 3,
        salvos: [salvo2],
        contacts: [contact("b1:d2", "d2")],
        targets: { d2: target("d2") },
        engine,
      });
      if (ra.states["d1"]!.structuralIntegrity !== rb.states["d2"]!.structuralIntegrity) differed++;
    }
    expect(differed).toBeGreaterThan(0);
  });

  it("linear penetration: shellPenetrationUm matches caliber*velocity/1000 at production scale", () => {
    // caliber 305 mm (12"), velocity 762 m/s -> 305*762/1000 = 232.41 mm = 232_410 µm
    expect(shellPenetrationUm(305_000, 762)).toBe(232_410);
    expect(shellPenetrationUm(343_000, 762)).toBe(261_366);
  });

  it("terminal ship has 0 hp and full battle loss", () => {
    const state = initialDamageState("d1");
    expect(hpOfState(state, 100)).toBe(100 as never);

    const sinking: ShipDamageState = { ...state, terminalStatus: "SINKING" };
    expect(hpOfState(sinking, 100)).toBe(0 as never);
    expect(battleLoss(100, sinking, 100)).toBe(100 as never);
  });
});
