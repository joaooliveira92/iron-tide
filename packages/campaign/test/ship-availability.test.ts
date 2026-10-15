import { describe, expect, it } from "vite-plus/test";
import { isShipOperational } from "../src/index.js";

describe("isShipOperational (DESIGN-23 section 20, ADR-0078)", () => {
  it("is true for a commissioned ship with no availability set", () => {
    expect(isShipOperational({ isUnderConstruction: false })).toBe(true);
  });
  it("is false while under construction", () => {
    expect(isShipOperational({ isUnderConstruction: true })).toBe(false);
  });
  it("is false when a rebuild or conversion made the ship unavailable", () => {
    expect(isShipOperational({ isUnderConstruction: false, availability: "UNAVAILABLE" })).toBe(
      false,
    );
  });
  it("is true for a degraded ship, which may operate in a limited way", () => {
    expect(isShipOperational({ isUnderConstruction: false, availability: "DEGRADED" })).toBe(true);
  });
  it("is false when both conditions hold", () => {
    expect(isShipOperational({ isUnderConstruction: true, availability: "UNAVAILABLE" })).toBe(
      false,
    );
  });
});
