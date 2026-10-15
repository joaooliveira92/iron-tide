//packages/combat/test/damage/event-record.test.ts
// INC-4 — Damage event record (DESIGN-41 §45).
// Proves: record completeness, hash computation, immutability.
import { describe, it, expect } from "vite-plus/test";
import {
  createDamageEventRecord,
  computeDamageEventHash,
  type DamageEventRecordBody,
} from "../../src/damage/index.js";

// ---------------------------------------------------------------------------
// Helpers

function sampleBody(overrides: Partial<DamageEventRecordBody> = {}): DamageEventRecordBody {
  return {
    battleMinute: 10,
    substep: 2,
    sourceId: "BATTERY-A",
    targetShipId: "SHIP-001",
    causalWeaponId: "SHELL-AP-1",
    hitLocation: "BELT-1",
    protectionInteraction: {
      effectiveResistanceUm: 300_000,
      penetrationMargin: 50_000,
      outcome: "FULL_PENETRATION",
    },
    componentEffects: [{ componentId: "TURRET-1", outcome: "DEGRADED", locationId: "TURRET-1" }],
    structureFlotationEffects: {
      structuralIntegrityAfter: 95_000,
      flotationReserveAfter: 48_000,
      uncappedStructuralDamage: 5_000,
      uncappedFlotationDamage: 2_000,
    },
    createdFireSources: [],
    createdFloodingSources: [],
    terminalTransition: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §45 — Record completeness

describe("AC-4: Record completeness (§45)", () => {
  it("creates a record with all required fields", () => {
    const body = sampleBody();
    const record = createDamageEventRecord(body);
    expect(record.battleMinute).toBe(10);
    expect(record.substep).toBe(2);
    expect(record.sourceId).toBe("BATTERY-A");
    expect(record.targetShipId).toBe("SHIP-001");
    expect(record.causalWeaponId).toBe("SHELL-AP-1");
    expect(record.hitLocation).toBe("BELT-1");
    expect(record.protectionInteraction).toBeDefined();
    expect(record.componentEffects).toHaveLength(1);
    expect(record.structureFlotationEffects).toBeDefined();
    expect(record.createdFireSources).toEqual([]);
    expect(record.createdFloodingSources).toEqual([]);
    expect(record.terminalTransition).toBeNull();
  });

  it("includes all component effect fields", () => {
    const record = createDamageEventRecord(sampleBody());
    const ce = record.componentEffects[0];
    expect(ce.componentId).toBe("TURRET-1");
    expect(ce.outcome).toBe("DEGRADED");
    expect(ce.locationId).toBe("TURRET-1");
  });

  it("includes all protection interaction fields", () => {
    const record = createDamageEventRecord(sampleBody());
    expect(record.protectionInteraction.effectiveResistanceUm).toBe(300_000);
    expect(record.protectionInteraction.penetrationMargin).toBe(50_000);
    expect(record.protectionInteraction.outcome).toBe("FULL_PENETRATION");
  });

  it("includes all structure/flotation fields", () => {
    const record = createDamageEventRecord(sampleBody());
    const sf = record.structureFlotationEffects;
    expect(sf.structuralIntegrityAfter).toBe(95_000);
    expect(sf.flotationReserveAfter).toBe(48_000);
    expect(sf.uncappedStructuralDamage).toBe(5_000);
    expect(sf.uncappedFlotationDamage).toBe(2_000);
  });

  it("terminalTransition can be a non-null string", () => {
    const record = createDamageEventRecord(sampleBody({ terminalTransition: "SINKING" }));
    expect(record.terminalTransition).toBe("SINKING");
  });

  it("createdFireSources can be populated", () => {
    const record = createDamageEventRecord(
      sampleBody({
        createdFireSources: [{ locationId: "COMP-1", intensityBp: 5_000, cause: "penetration" }],
      }),
    );
    expect(record.createdFireSources).toHaveLength(1);
    expect(record.createdFireSources[0].locationId).toBe("COMP-1");
  });

  it("createdFloodingSources can be populated", () => {
    const record = createDamageEventRecord(
      sampleBody({
        createdFloodingSources: [{ compartmentId: "COMP-1", rateKgMin: 500, cause: "penetration" }],
      }),
    );
    expect(record.createdFloodingSources).toHaveLength(1);
    expect(record.createdFloodingSources[0].compartmentId).toBe("COMP-1");
  });
});

// ---------------------------------------------------------------------------
// §45 — Hash computation

describe("AC-4: Hash computation (§45)", () => {
  it("computes a stable hash for identical records built independently", () => {
    const hash1 = computeDamageEventHash(sampleBody());
    const hash2 = computeDamageEventHash(sampleBody());
    expect(hash1).toBe(hash2);
  });

  it("produces a 64-char sha256 hex digest", () => {
    const hash = computeDamageEventHash(sampleBody());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any authoritative field changes", () => {
    const base = computeDamageEventHash(sampleBody());
    const changedMinute = computeDamageEventHash(sampleBody({ battleMinute: 11 }));
    expect(base).not.toBe(changedMinute);

    const changedOutcome = computeDamageEventHash(
      sampleBody({
        protectionInteraction: { ...sampleBody().protectionInteraction, outcome: "DUD" },
      }),
    );
    expect(base).not.toBe(changedOutcome);

    const changedComponent = computeDamageEventHash(sampleBody({ componentEffects: [] }));
    expect(base).not.toBe(changedComponent);
  });

  it("createDamageEventRecord sets recordHash matching computeDamageEventHash", () => {
    const body = sampleBody();
    const record = createDamageEventRecord(body);
    expect(record.recordHash).toBe(computeDamageEventHash(body));
  });
});

// ---------------------------------------------------------------------------
// §45 — Immutability

describe("AC-4: Immutability (§45)", () => {
  it("returned record is frozen", () => {
    const record = createDamageEventRecord(sampleBody());
    expect(Object.isFrozen(record)).toBe(true);
  });

  it("nested objects are frozen", () => {
    const record = createDamageEventRecord(sampleBody());
    expect(Object.isFrozen(record.protectionInteraction)).toBe(true);
    expect(Object.isFrozen(record.componentEffects[0])).toBe(true);
    expect(Object.isFrozen(record.structureFlotationEffects)).toBe(true);
  });

  it("arrays are frozen", () => {
    const record = createDamageEventRecord(sampleBody());
    expect(Object.isFrozen(record.componentEffects)).toBe(true);
    expect(Object.isFrozen(record.createdFireSources)).toBe(true);
    expect(Object.isFrozen(record.createdFloodingSources)).toBe(true);
  });
});
