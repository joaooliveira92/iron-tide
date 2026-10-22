import type { YardOption } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../../lib/presentation-format/index.js";
import { yardRows } from "./yardRows.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const yard = (over: Partial<YardOption>): YardOption => ({
  yardId: "yard_small",
  maxLengthMm: 90_000,
  maxBeamMm: 14_000,
  maxDisplacementKg: 3_000_000,
  craneLiftKg: 50_000,
  exceeds: [],
  months: 12,
  chosen: false,
  ...over,
});

describe("yardRows", () => {
  it("marks the forecast yard and the others that could build", () => {
    const rows = yardRows(
      [yard({ chosen: true }), yard({ yardId: "yard_large", months: 1 })],
      FORMAT,
    );
    expect(rows[0]).toMatchObject({ tone: "chosen", status: "Builds here · 12 months" });
    expect(rows[1]).toMatchObject({
      tone: "ok",
      status: "Could build · 1 month",
      name: "yard large",
    });
  });
  it("names every exceeded limit for a yard that cannot hold the hull", () => {
    const [row] = yardRows([yard({ exceeds: ["LENGTH", "DISPLACEMENT"], months: null })], FORMAT);
    expect(row).toMatchObject({ tone: "blocked", status: "Cannot build: too long, too heavy" });
  });
  it("explains a yard that holds the hull but cannot finish it", () => {
    const [row] = yardRows([yard({ months: null })], FORMAT);
    expect(row!.status).toMatch(/cannot finish/);
  });
  it("formats capacity and keeps yard order", () => {
    const rows = yardRows([yard({}), yard({ yardId: "yard_z" })], FORMAT);
    expect(rows[0]!.capacity).toBe("Holds up to 3,000 t, 90 m × 14 m");
    expect(rows.map((r) => r.yardId)).toEqual(["yard_small", "yard_z"]);
  });
  it("is empty for no yards", () => {
    expect(yardRows([], FORMAT)).toEqual([]);
  });
});
