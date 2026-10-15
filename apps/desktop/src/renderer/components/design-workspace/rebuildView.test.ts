import { describe, expect, it } from "vite-plus/test";
import { limitRows } from "./rebuildView.js";

const balance = {
  maxDisplacementIncreaseBp: 2_000,
  maxSpeedIncreaseMilliKnots: 3_000,
  maxLengthChangeBp: 500,
  maxBeamChangeBp: 500,
};
const none = {
  displacementChangeBp: 0,
  speedChangeMilliKnots: 0,
  lengthChangeBp: 0,
  beamChangeBp: 0,
};

describe("limitRows", () => {
  it("shows every limit with the ruleset's own value, in a fixed order", () => {
    const rows = limitRows(none, balance);
    expect(rows.map((r) => [r.id, r.limit])).toEqual([
      ["displacement", "up to +20.0 %"],
      ["speed", "up to +3.0 kn"],
      ["length", "within ±5.0 %"],
      ["beam", "within ±5.0 %"],
    ]);
    expect(rows.every((r) => !r.over)).toBe(true);
    expect(rows.map((r) => r.change)).toEqual(["0.0 %", "0.0 kn", "0.0 %", "0.0 %"]);
  });

  it("signs the changes and marks only the limits that are exceeded", () => {
    const rows = limitRows(
      {
        displacementChangeBp: 2_500,
        speedChangeMilliKnots: -1_500,
        lengthChangeBp: -600,
        beamChangeBp: 300,
      },
      balance,
    );
    expect(rows.map((r) => r.change)).toEqual(["+25.0 %", "-1.5 kn", "-6.0 %", "+3.0 %"]);
    expect(rows.map((r) => r.over)).toEqual([true, false, true, false]);
  });

  it("treats exactly the limit as allowed, and any decrease in displacement or speed as allowed", () => {
    const rows = limitRows(
      {
        displacementChangeBp: 2_000,
        speedChangeMilliKnots: 3_000,
        lengthChangeBp: 500,
        beamChangeBp: -500,
      },
      balance,
    );
    expect(rows.every((r) => !r.over)).toBe(true);
    const lighter = limitRows(
      { ...none, displacementChangeBp: -9_000, speedChangeMilliKnots: -9_000 },
      balance,
    );
    expect(lighter.slice(0, 2).every((r) => !r.over)).toBe(true);
  });
});
