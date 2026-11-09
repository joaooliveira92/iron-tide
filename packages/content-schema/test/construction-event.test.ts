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
    expect([...CONSTRUCTION_EVENT_KINDS]).toEqual(["DELAY"]);
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
});
