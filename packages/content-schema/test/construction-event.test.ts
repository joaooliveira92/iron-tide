import { describe, expect, it } from "vite-plus/test";
import {
  CONSTRUCTION_EVENT_KINDS,
  ConstructionEventSchema,
  type ConstructionEvent,
} from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
  note: "PROVISIONAL authoring fixture",
};

function validEvent(): ConstructionEvent {
  return {
    id: "steel_plate_shortage",
    kind: "DELAY",
    probabilityBp: 150,
    minMonths: 1,
    maxMonths: 3,
    pressureMultiplierBp: 20_000,
    reasonCode: "STEEL_PLATE_SHORTAGE",
    causeKey: "construction.event.steel_plate_shortage",
    eraWindow: { fromMonth: "1880-01", toMonth: "1899-12" },
    provenance,
  };
}

describe("ConstructionEventSchema", () => {
  it("accepts a well-formed delay event", () => {
    expect(decodeOk(ConstructionEventSchema, validEvent())).toBe(true);
  });

  it("accepts an event without an era window", () => {
    const { eraWindow: _window, ...open } = validEvent();
    expect(decodeOk(ConstructionEventSchema, open)).toBe(true);
  });

  it("names the supported kinds", () => {
    expect([...CONSTRUCTION_EVENT_KINDS]).toEqual(["DELAY", "OVERRUN"]);
  });

  it("rejects an excess key", () => {
    expect(decodeOk(ConstructionEventSchema, { ...validEvent(), extra: 1 })).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(decodeOk(ConstructionEventSchema, { ...validEvent(), kind: "STRIKE" })).toBe(false);
  });

  it("rejects a probability outside 1 to 10000 basis points", () => {
    expect(decodeOk(ConstructionEventSchema, { ...validEvent(), probabilityBp: 0 })).toBe(false);
    expect(decodeOk(ConstructionEventSchema, { ...validEvent(), probabilityBp: 10_001 })).toBe(
      false,
    );
    expect(decodeOk(ConstructionEventSchema, { ...validEvent(), probabilityBp: 1.5 })).toBe(false);
  });

  it("rejects a reason code that is not upper snake case", () => {
    expect(
      decodeOk(ConstructionEventSchema, { ...validEvent(), reasonCode: "steel shortage" }),
    ).toBe(false);
  });

  it("rejects an empty cause key", () => {
    expect(decodeOk(ConstructionEventSchema, { ...validEvent(), causeKey: "" })).toBe(false);
  });

  it("rejects an era window that ends before it starts", () => {
    const event = { ...validEvent(), eraWindow: { fromMonth: "1900-01", toMonth: "1890-01" } };
    expect(decodeIssue(ConstructionEventSchema, event)).toContain("fromMonth");
  });

  it("requires provenance", () => {
    const { provenance: _provenance, ...bare } = validEvent();
    expect(decodeOk(ConstructionEventSchema, bare)).toBe(false);
  });

  describe("delay length and capacity pressure", () => {
    it("requires the length range and the pressure multiplier", () => {
      for (const key of ["minMonths", "maxMonths", "pressureMultiplierBp"]) {
        const full: Record<string, unknown> = { ...validEvent() };
        const { [key]: _omitted, ...bare } = full;
        expect(decodeOk(ConstructionEventSchema, bare)).toBe(false);
      }
    });

    it("rejects a length below one month, above a year, or fractional", () => {
      expect(decodeOk(ConstructionEventSchema, { ...validEvent(), minMonths: 0 })).toBe(false);
      expect(decodeOk(ConstructionEventSchema, { ...validEvent(), maxMonths: 13 })).toBe(false);
      expect(decodeOk(ConstructionEventSchema, { ...validEvent(), maxMonths: 2.5 })).toBe(false);
    });

    it("rejects an inverted length range", () => {
      expect(
        decodeIssue(ConstructionEventSchema, { ...validEvent(), minMonths: 3, maxMonths: 1 }),
      ).toContain("minMonths");
    });

    it("rejects a multiplier that would lower the chance or is absurdly high", () => {
      expect(
        decodeOk(ConstructionEventSchema, { ...validEvent(), pressureMultiplierBp: 9_999 }),
      ).toBe(false);
      expect(
        decodeOk(ConstructionEventSchema, { ...validEvent(), pressureMultiplierBp: 100_001 }),
      ).toBe(false);
      expect(
        decodeOk(ConstructionEventSchema, { ...validEvent(), pressureMultiplierBp: 10_000 }),
      ).toBe(true);
    });

    it("rejects delay fields on an overrun event", () => {
      expect(
        decodeOk(ConstructionEventSchema, {
          id: "design_change_rework",
          kind: "OVERRUN",
          probabilityBp: 120,
          minBp: 200,
          maxBp: 1000,
          capBp: 3000,
          minMonths: 1,
          reasonCode: "DESIGN_CHANGE_REWORK",
          causeKey: "construction.event.design_change_rework",
          provenance,
        }),
      ).toBe(false);
    });
  });

  describe("overrun events", () => {
    const overrun = (): Record<string, unknown> => ({
      id: "design_change_rework",
      kind: "OVERRUN",
      probabilityBp: 120,
      minBp: 200,
      maxBp: 1000,
      capBp: 3000,
      reasonCode: "DESIGN_CHANGE_REWORK",
      causeKey: "construction.event.design_change_rework",
      provenance,
    });

    it("accepts a well-formed overrun event", () => {
      expect(decodeOk(ConstructionEventSchema, overrun())).toBe(true);
    });

    it("requires the magnitude and cap fields", () => {
      for (const key of ["minBp", "maxBp", "capBp"]) {
        const { [key]: _omitted, ...bare } = overrun();
        expect(decodeOk(ConstructionEventSchema, bare)).toBe(false);
      }
    });

    it("rejects an excess key", () => {
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), extra: 1 })).toBe(false);
    });

    it("rejects a negative or zero magnitude", () => {
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), minBp: -1 })).toBe(false);
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), minBp: 0 })).toBe(false);
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), maxBp: -5 })).toBe(false);
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), capBp: 0 })).toBe(false);
    });

    it("rejects a magnitude range that is inverted", () => {
      expect(
        decodeIssue(ConstructionEventSchema, { ...overrun(), minBp: 900, maxBp: 100 }),
      ).toContain("minBp");
    });

    it("rejects a magnitude above the cap or a cap above 100 percent", () => {
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), maxBp: 4000 })).toBe(false);
      expect(decodeOk(ConstructionEventSchema, { ...overrun(), capBp: 10_001 })).toBe(false);
    });

    it("rejects overrun fields on a delay event", () => {
      expect(decodeOk(ConstructionEventSchema, { ...validEvent(), minBp: 200 })).toBe(false);
    });
  });
});
