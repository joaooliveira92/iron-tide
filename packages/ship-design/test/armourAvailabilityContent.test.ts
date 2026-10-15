import { describe, expect, it } from "vite-plus/test";
import {
  armourAvailabilityFindings,
  armourMaterialOptions,
  compileDesign,
  type ArmourRegion,
} from "../src/index.js";
import { earlyContext } from "./helpers/earlyContext.js";
import { majestic } from "./helpers/references.js";

/** The shipped armour availability (ticket 25), checked against the real EARLY-band balance and tech tree. */
const region = (materialId: string): ArmourRegion => ({
  region: "BELT_MAIN",
  thicknessUm: 100_000,
  lengthMm: 50_000,
  heightMm: 2_000,
  materialId,
  cosObliquityBp: 10_000,
});
const gate = (materialId: string, month: string) => {
  const ctx = earlyContext(month);
  return armourAvailabilityFindings(
    [region(materialId)],
    ctx.balance.armour,
    month,
    ctx.unlockedTechs,
  );
};
const ids = (materialId: string, month: string) => gate(materialId, month).map((f) => f.id);

describe("shipped armour material availability", () => {
  it("declares every armour material in the balance", () => {
    const { balance } = earlyContext("1890-01");
    const availability = Object.keys(balance.armour.materialAvailability ?? {}).sort();
    expect(availability).toEqual(Object.keys(balance.armour.materialEffBp).sort());
  });

  it("iron and mild steel are open from the start", () => {
    for (const m of ["wrought_iron", "iron", "mild_steel", "steel"])
      expect(ids(m, "1880-01")).toEqual([]);
  });

  it("harvey plate is blocked before 1892 and open from then", () => {
    expect(ids("harvey", "1891-12")).toEqual(["ARMOUR_TECH_UNAVAILABLE"]);
    expect(gate("harvey", "1891-12")[0]!.severity).toBe("BLOCKING");
    expect(ids("harvey", "1892-01")).toEqual([]);
  });

  it("each plate is blocked until its technology year, and the reason names the technology or month", () => {
    const first: Record<string, string> = {
      compound: "1886-01",
      nickel_steel: "1889-01",
      harvey: "1892-01",
      krupp: "1900-01",
    };
    for (const [material, month] of Object.entries(first)) {
      const [y, m] = month.split("-").map(Number) as [number, number];
      const before = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
      expect(ids(material, before), `${material} before ${month}`).toContain(
        "ARMOUR_TECH_UNAVAILABLE",
      );
      expect(
        ids(material, month).includes("ARMOUR_TECH_UNAVAILABLE"),
        `${material} at ${month}`,
      ).toBe(false);
    }
    expect(gate("krupp", "1895-01")[0]!.why).toMatch(/hc_krupp_cemented_armor|1900-01/);
  });

  it("compound is flagged obsolete (advisory) once nickel steel exists, but stays usable", () => {
    const f = gate("compound", "1890-01");
    expect(f.map((x) => [x.id, x.severity])).toEqual([["ARMOUR_MATERIAL_OBSOLETE", "ADVISORY"]]);
    expect(ids("compound", "1887-06")).toEqual([]);
  });

  it("sets no maximum plate thickness (no source gives one)", () => {
    const { balance } = earlyContext("1890-01");
    for (const a of Object.values(balance.armour.materialAvailability ?? {}))
      expect(a.maxThicknessUm).toBeUndefined();
  });

  it("a new design with harvey plate is blocked before 1892 and not after", () => {
    const blocked = compileDesign(majestic, earlyContext("1890-06"));
    expect(blocked.valid).toBe(false);
    expect(
      blocked.findings.some((f) => f.id === "ARMOUR_TECH_UNAVAILABLE" && f.severity === "BLOCKING"),
    ).toBe(true);
    const open = compileDesign(majestic, earlyContext("1896-01"));
    expect(open.findings.some((f) => f.id === "ARMOUR_TECH_UNAVAILABLE")).toBe(false);
  });

  it("the Drawing Board's material options mark unavailable plates with the reason", () => {
    const ctx = earlyContext("1890-06");
    const options = armourMaterialOptions(ctx.balance.armour, "1890-06", ctx.unlockedTechs);
    const harvey = options.find((o) => o.id === "harvey")!;
    expect(harvey).toMatchObject({ available: false });
    expect(harvey.unavailableReason).toMatch(/hc_harvey_armor|1892-01/);
    expect(options.find((o) => o.id === "nickel_steel")!.available).toBe(true);
    expect(options.find((o) => o.id === "compound")!.obsolete).toBe(true);
  });
});
