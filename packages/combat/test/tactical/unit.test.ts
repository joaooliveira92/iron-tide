import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { promoteTacticalUnit, TACTICAL_UNIT_PROMOTION_INVALID } from "../../src/tactical/unit.js";
import { classifyShip } from "../../src/tactical/shipType.js";
import { makeDesign, makeShip } from "../fixtures/unit-fixture.js";

describe("TacticalShipUnit promotion (AC-1)", () => {
  it("promotes a commissioned ship purely and deterministically", () => {
    const ship = makeShip();
    const design = makeDesign();
    const opts = { sideId: "ATTACKER", preBattleStateHash: "state" };
    const u1 = promoteTacticalUnit(ship, design, opts);
    const u2 = promoteTacticalUnit(ship, design, opts);
    expect(u1).toEqual(u2); // purity + determinism
    expect(u1.campaignShipId).toBe(ship.id);
    expect(u1.shipType).toBe(classifyShip(design)); // canonical ship type
    expect(u1.armorBeltUm).toBe(design.normalizedArmorUm);
    expect(u1.mainGunsCaliberUm).toBe(design.mainGunsCaliber);
    expect(u1.mainGunsCount).toBe(design.mainGunsCount);
    expect(u1.crewComplement).toBe(design.crewComplement);
    expect(u1.displacementKg).toBe(design.normalizedDisplacementKg);
    expect(u1.designedSpeedUms).toBe(design.normalizedSpeedUms);
    expect(u1.hitPoints).toBe(ship.hitPoints);
    expect(u1.maxHitPoints).toBe(ship.maxHitPoints);
    expect(u1.provenance.campaignAssetId).toBe(ship.id);
    expect(u1.provenance.sourceCompiledDesignHash).toBe(design.compiledHash);
  });

  it("excludes under-construction ships loudly", () => {
    const ship = makeShip({ isUnderConstruction: true, constructionProgress: SafeInt(50) });
    const design = makeDesign();
    expect(() =>
      promoteTacticalUnit(ship, design, { sideId: "ATTACKER", preBattleStateHash: "s" }),
    ).toThrow(new RegExp(TACTICAL_UNIT_PROMOTION_INVALID));
  });

  it("fails loudly on missing design reference", () => {
    const ship = makeShip({}, { designVersionId: "des_missing" });
    const design = makeDesign(); // mismatched
    expect(() =>
      promoteTacticalUnit(ship, design, { sideId: "ATTACKER", preBattleStateHash: "s" }),
    ).toThrow(BluewaveError);
  });

  it("carries provenance uniqueness invariants", () => {
    const ship = makeShip();
    const design = makeDesign();
    const u = promoteTacticalUnit(ship, design, {
      sideId: "ATTACKER",
      preBattleStateHash: "state",
    });
    expect(u.provenance.provenanceHash).toBeTruthy();
    expect(u.provenance.persistenceDisposition).toBe("persistent");
  });
});
