import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { parseDomainEventBody, parseDomainEventEnvelope } from "../src/index.js";
import { budgetEvent } from "./fixtures.js";

describe("event validation", () => {
  it("accepts a valid envelope", () => {
    expect(parseDomainEventEnvelope(budgetEvent())).toEqual(budgetEvent());
  });

  it("rejects eventType and body.kind mismatches", () => {
    expect(() =>
      parseDomainEventEnvelope({ ...budgetEvent(), eventType: "BattleResolved" }),
    ).toThrow(/eventType must match body.kind/);
  });

  it("rejects invalid timestamps", () => {
    expect(() => parseDomainEventEnvelope({ ...budgetEvent(), timestamp: "yesterday" })).toThrow();
  });

  it("rejects unsafe sequence numbers", () => {
    expect(() =>
      parseDomainEventEnvelope({ ...budgetEvent(), sequenceNumber: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow();
  });

  it("rejects unknown properties", () => {
    expect(() => parseDomainEventEnvelope({ ...budgetEvent(), unexpected: true })).toThrow();
  });
});

describe("event validation parity (Zod → Effect Schema)", () => {
  it("serializes a decoded envelope byte-compatibly (field names + ordering)", () => {
    // The literal is the exact JSON the previous Zod `.strict()` schema produced
    // (schema key order), verified against Zod v4 before the migration.
    const parsed = parseDomainEventEnvelope(budgetEvent());
    expect(JSON.stringify(parsed)).toBe(
      '{"eventId":"evt-1","version":"1","aggregateType":"Nation","aggregateId":"nation-1",' +
        '"eventType":"NationBudgetChanged","timestamp":"2026-08-16T12:00:00.000Z",' +
        '"body":{"kind":"NationBudgetChanged","nationId":"nation-1","previousTreasury":100,' +
        '"newTreasury":90,"delta":-10,"reason":"construction"},"sequenceNumber":1}',
    );
  });

  it("trims non-empty strings, rejecting whitespace-only values", () => {
    const parsed = parseDomainEventEnvelope({ ...budgetEvent(), eventId: "  evt-1  " });
    expect(parsed.eventId).toBe("evt-1");

    expect(() => parseDomainEventEnvelope({ ...budgetEvent(), eventId: "   " })).toThrow();
    expect(() =>
      parseDomainEventEnvelope({
        ...budgetEvent(),
        body: { ...budgetEvent().body, nationId: "\t\n " },
      }),
    ).toThrow();
  });

  it("accepts ISO-8601 instants with Z, ±HH:MM offsets, and fractional seconds", () => {
    for (const timestamp of [
      "2026-08-16T12:00:00Z",
      "2026-08-16T12:00:00+05:30",
      "2026-08-16T12:00:00-08:00",
      "2026-08-16T12:00:00.123Z",
      "2026-08-16T12:00:00.123+00:00",
      "2024-02-29T00:00:00Z",
    ]) {
      expect(parseDomainEventEnvelope({ ...budgetEvent(), timestamp }).timestamp).toBe(timestamp);
    }
  });

  it("rejects date-only, space-separated, offset-less, and impossible timestamps", () => {
    for (const timestamp of [
      "yesterday",
      "2026-08-16",
      "2026-08-16 12:00:00Z",
      "2026-08-16T12:00:00",
      "2025-02-29T00:00:00Z",
      "2026-13-01T00:00:00Z",
      "2026-08-16T24:00:00Z",
      "2026-08-16T12:00:00+24:00",
    ]) {
      expect(() => parseDomainEventEnvelope({ ...budgetEvent(), timestamp })).toThrow();
    }
  });

  it("enforces the safe-integer range exactly", () => {
    expect(
      parseDomainEventEnvelope({
        ...budgetEvent(),
        sequenceNumber: SafeInt(Number.MAX_SAFE_INTEGER),
      }).sequenceNumber,
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      parseDomainEventEnvelope({ ...budgetEvent(), sequenceNumber: SafeInt(0) }).sequenceNumber,
    ).toBe(0);
    expect(() =>
      parseDomainEventEnvelope({ ...budgetEvent(), sequenceNumber: Number.MIN_SAFE_INTEGER - 1 }),
    ).toThrow();
    expect(() => parseDomainEventEnvelope({ ...budgetEvent(), sequenceNumber: -1 })).toThrow();
  });

  it("rejects non-finite numbers where Zod did", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5]) {
      expect(() => parseDomainEventEnvelope({ ...budgetEvent(), sequenceNumber: value })).toThrow();
    }
  });

  it("rejects an unknown property nested inside the body", () => {
    expect(() => parseDomainEventBody({ ...budgetEvent().body, unexpected: true })).toThrow();
  });

  it("decodes every discriminated-union member", () => {
    const bodies = [
      budgetEvent().body,
      {
        kind: "ConstructionProgressed",
        projectId: "p1",
        nationId: "n1",
        previousWork: 0,
        newWork: 10,
        workAdded: 10,
      },
      {
        kind: "ShipRebuilt",
        projectId: "p1",
        nationId: "n1",
        shipId: "s1",
        fromDesignVersionId: "d1",
        toDesignVersionId: "d2",
      },
      {
        kind: "ConstructionProjectCancelled",
        projectId: "p1",
        nationId: "n1",
        projectType: "REBUILD",
        consumedWork: 4,
        refundedAmount: 0,
        lostAmount: 4,
        salvageableAmount: 0,
        reason: "CANCELLATION_WORK_CONSUMED",
      },
      { kind: "ResearchProgressed", nationId: "n1", techId: "t1", previousPoints: 0, newPoints: 5 },
      { kind: "BattleInitiated", battleId: "b1", attackerId: "n1", defenderId: "n2", areaId: "a1" },
      { kind: "BattleResolved", battleId: "b1", winnerId: "n1", loserId: "n2" },
      {
        kind: "TechnologyDiscovered",
        nationId: "n1",
        techId: "t1",
        researchFieldId: "field",
        discoveryMonth: "1880-01",
        cost: 0,
      },
      {
        kind: "ShipStationAssignmentChanged",
        nationId: "n1",
        shipId: "s1",
        fromAssignment: "NONE",
        toAssignment: "FOREIGN_STATION",
        reason: "ASSIGNED",
      },
      {
        kind: "PresenceShortfall",
        nationId: "n1",
        areaId: "a1",
        requiredTons: 400,
        presentTons: 100,
        shortfallTons: 300,
      },
      { kind: "PrestigeLossRequested", nationId: "n1", areaId: "a1", shortfallTons: 300 },
      { kind: "RevoltPressureRequested", nationId: "n1", areaId: "a1", shortfallTons: 300 },
    ] as const;

    for (const body of bodies) {
      expect(parseDomainEventBody(body).kind).toBe(body.kind);
    }
  });

  it("rejects an unknown body kind and an invalid discovery month", () => {
    expect(() => parseDomainEventBody({ ...budgetEvent().body, kind: "Unknown" })).toThrow();
    expect(() =>
      parseDomainEventBody({
        kind: "TechnologyDiscovered",
        nationId: "n1",
        techId: "t1",
        researchFieldId: "field",
        discoveryMonth: "1880-13",
        cost: 0,
      }),
    ).toThrow();
    expect(() =>
      parseDomainEventBody({
        kind: "TechnologyDiscovered",
        nationId: "n1",
        techId: "t1",
        researchFieldId: "field",
        discoveryMonth: "1880-1",
        cost: 0,
      }),
    ).toThrow();
  });
});

describe("ShipStationAssignmentChanged (S-5 03)", () => {
  const body = {
    kind: "ShipStationAssignmentChanged",
    nationId: "n1",
    shipId: "s1",
    fromAssignment: "FOREIGN_STATION",
    toAssignment: "NONE",
    reason: "READINESS_LEFT_ACTIVE",
  } as const;

  it("rejects excess keys and empty fields", () => {
    expect(() => parseDomainEventBody({ ...body, extra: 1 })).toThrow();
    expect(() => parseDomainEventBody({ ...body, shipId: "" })).toThrow();
    expect(parseDomainEventBody(body).kind).toBe("ShipStationAssignmentChanged");
  });
});

describe("PresenceShortfall (S-5 05)", () => {
  const body = {
    kind: "PresenceShortfall",
    nationId: "n1",
    areaId: "a1",
    requiredTons: 400,
    presentTons: 100,
    shortfallTons: 300,
  } as const;

  it("rejects excess keys, empty ids, negative tonnage and a zero or negative shortfall", () => {
    expect(parseDomainEventBody(body).kind).toBe("PresenceShortfall");
    expect(() => parseDomainEventBody({ ...body, extra: 1 })).toThrow();
    expect(() => parseDomainEventBody({ ...body, areaId: "" })).toThrow();
    expect(() => parseDomainEventBody({ ...body, presentTons: -1 })).toThrow();
    expect(() => parseDomainEventBody({ ...body, shortfallTons: 0 })).toThrow();
    expect(() => parseDomainEventBody({ ...body, requiredTons: 1.5 })).toThrow();
  });
});

describe("penalty requests (S-5 06)", () => {
  for (const kind of ["PrestigeLossRequested", "RevoltPressureRequested"] as const) {
    it(`${kind} carries integer tons only and rejects excess keys, empty ids and a non-positive shortfall`, () => {
      const body = { kind, nationId: "n1", areaId: "a1", shortfallTons: 300 };
      expect(parseDomainEventBody(body).kind).toBe(kind);
      expect(() => parseDomainEventBody({ ...body, magnitude: 5 })).toThrow();
      expect(() => parseDomainEventBody({ ...body, nationId: "" })).toThrow();
      expect(() => parseDomainEventBody({ ...body, shortfallTons: 0 })).toThrow();
      expect(() => parseDomainEventBody({ ...body, shortfallTons: 1.5 })).toThrow();
    });
  }
});
