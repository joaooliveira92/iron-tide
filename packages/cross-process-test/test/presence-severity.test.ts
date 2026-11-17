import { describe, expect, it } from "vite-plus/test";
import { measurePresenceSeverity } from "../src/presence-severity.js";

const SACKING_THRESHOLD = 16;
const FIRST_YEAR = 12;

describe("1880 presence charge severity for a passive player (#860, decision request 0060)", () => {
  it("leaves no human-playable nation sack-eligible inside the first campaign year when orders are ignored", () => {
    const rows = measurePresenceSeverity({
      months: FIRST_YEAR,
      sackingThreshold: SACKING_THRESHOLD,
      postures: ["orders_ignored"],
    });
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.filter((row) => row.eligibleMonth !== undefined)).toEqual([]);
    expect(rows.filter((row) => row.sackedMonth !== undefined)).toEqual([]);
  });

  it("still charges a passive uk after the first year until it is sack-eligible", () => {
    const [uk] = measurePresenceSeverity({
      months: 20,
      sackingThreshold: SACKING_THRESHOLD,
      nationIds: ["uk"],
      postures: ["orders_ignored"],
    });
    expect(uk?.firstChargeMonth).toBe(13);
    expect(uk?.eligibleMonth).toBe(16);
    expect(uk?.prestigeByMonth[FIRST_YEAR - 1]).toBe(20);
    expect(uk?.prestigeByMonth[15]).toBe(SACKING_THRESHOLD);
  });

  it("charges the attentive uk nothing over the same horizon once it posts the idle ship every month", () => {
    const [uk] = measurePresenceSeverity({
      months: 20,
      sackingThreshold: SACKING_THRESHOLD,
      nationIds: ["uk"],
      postures: ["posts_idle_ship"],
    });
    expect(uk?.chargeMonths).toBe(0);
    expect(uk?.eligibleMonth).toBeUndefined();
  });
});
