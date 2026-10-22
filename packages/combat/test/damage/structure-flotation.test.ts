import { describe, it, expect } from "vite-plus/test";
import { resolveStructureFlotation } from "@bluewave/combat/damage";

describe("AC-4: Structure/flotation formula (§8)", () => {
  it("structuralIntegrityAfter = max(0, before - structuralDamage)", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 10_000,
      flotationDamage: 0,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.structuralIntegrityAfter).toBe(90_000);
  });

  it("flotationReserveAfter = max(0, before - immediateFlotationDamage)", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 0,
      flotationDamage: 5_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.flotationReserveAfter).toBe(45_000);
  });

  it("both structural and flotation damage applied simultaneously", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 20_000,
      flotationDamage: 10_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.structuralIntegrityAfter).toBe(80_000);
    expect(result.flotationReserveAfter).toBe(40_000);
  });
});

describe("AC-4: Cap preservation (floor at 0)", () => {
  it("structuralIntegrity floors at 0 (cannot go negative)", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 150_000,
      flotationDamage: 0,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.structuralIntegrityAfter).toBe(0);
  });

  it("flotationReserve floors at 0 (cannot go negative)", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 0,
      flotationDamage: 75_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.flotationReserveAfter).toBe(0);
  });

  it("both cap at 0 simultaneously", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 200_000,
      flotationDamage: 100_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.structuralIntegrityAfter).toBe(0);
    expect(result.flotationReserveAfter).toBe(0);
  });

  it("exact equality: damage equals current value results in 0", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 100_000,
      flotationDamage: 50_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.structuralIntegrityAfter).toBe(0);
    expect(result.flotationReserveAfter).toBe(0);
  });
});

describe("AC-4: Uncapped amount in record (§8)", () => {
  it("uncappedStructuralDamage preserves raw damage even when capped", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 150_000,
      flotationDamage: 0,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.uncappedStructuralDamage).toBe(150_000);
    expect(result.structuralIntegrityAfter).toBe(0);
  });

  it("uncappedFlotationDamage preserves raw damage even when capped", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 0,
      flotationDamage: 75_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.uncappedFlotationDamage).toBe(75_000);
    expect(result.flotationReserveAfter).toBe(0);
  });

  it("uncapped amounts equal applied amounts when no cap triggered", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 10_000,
      flotationDamage: 5_000,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.uncappedStructuralDamage).toBe(10_000);
    expect(result.uncappedFlotationDamage).toBe(5_000);
    expect(result.structuralIntegrityAfter).toBe(90_000);
    expect(result.flotationReserveAfter).toBe(45_000);
  });
});

describe("AC-4: Edge cases", () => {
  it("zero damage leaves values unchanged", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 0,
      flotationDamage: 0,
      currentStructuralIntegrity: 100_000,
      currentFlotationReserve: 50_000,
    });
    expect(result.structuralIntegrityAfter).toBe(100_000);
    expect(result.flotationReserveAfter).toBe(50_000);
    expect(result.uncappedStructuralDamage).toBe(0);
    expect(result.uncappedFlotationDamage).toBe(0);
  });

  it("zero current values with zero damage stay at zero", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 0,
      flotationDamage: 0,
      currentStructuralIntegrity: 0,
      currentFlotationReserve: 0,
    });
    expect(result.structuralIntegrityAfter).toBe(0);
    expect(result.flotationReserveAfter).toBe(0);
  });

  it("large damage numbers are handled (no overflow)", () => {
    const result = resolveStructureFlotation({
      structuralDamage: 1_000_000,
      flotationDamage: 500_000,
      currentStructuralIntegrity: 999_999,
      currentFlotationReserve: 499_999,
    });
    expect(result.structuralIntegrityAfter).toBe(0);
    expect(result.flotationReserveAfter).toBe(0);
    expect(result.uncappedStructuralDamage).toBe(1_000_000);
    expect(result.uncappedFlotationDamage).toBe(500_000);
  });
});
