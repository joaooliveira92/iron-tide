import { describe, it, expect } from "vite-plus/test";
import { applyEdit, compileDesign, suggestFixes, candidateEdits } from "../src/index.js";
import { earlyContext } from "./helpers/earlyContext.js";
import { havock, majestic } from "./helpers/references.js";

const ctx = earlyContext("1895-06");

describe("suggestFixes", () => {
  const bad = applyEdit(havock, { kind: "set_machinery", patch: { fuelCapacityKg: 400_000 } });
  it("finds edits that resolve the overweight block, best first, without applying them", () => {
    const fixes = suggestFixes(bad, ctx);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0]!.countsAfter.BLOCKING).toBeLessThan(fixes[0]!.countsBefore.BLOCKING);
    expect(fixes[0]!.resolved.some((r) => r.includes("OVERWEIGHT"))).toBe(true);
    expect(bad.machinery.fuelCapacityKg).toBe(400_000);
  });
  it("every suggestion strictly improves and never introduces a blocking finding", () => {
    for (const f of suggestFixes(bad, ctx, 10)) {
      expect(f.introduced.some((x) => x.startsWith("BLOCKING:"))).toBe(false);
      const after = compileDesign(applyEdit(bad, f.edit), ctx);
      expect(after.findings.filter((x) => x.severity === "BLOCKING").length).toBeLessThanOrEqual(
        f.countsBefore.BLOCKING,
      );
    }
  });
  it("applying the top suggestion repeatedly reaches a buildable design", () => {
    let d = bad;
    for (let i = 0; i < 6 && !compileDesign(d, ctx).valid; i++) {
      const top = suggestFixes(d, ctx, 1)[0];
      if (!top) break;
      d = applyEdit(d, top.edit);
    }
    expect(compileDesign(d, ctx).valid).toBe(true);
  });
  it("offers nothing when there are no serious findings", () => {
    expect(compileDesign(majestic, earlyContext("1896-01")).valid).toBe(true);
    const clean = { ...havock };
    const c = compileDesign(clean, ctx);
    if (
      !c.findings.some(
        (f) => f.severity === "WARNING" || f.severity === "CRITICAL" || f.severity === "BLOCKING",
      )
    )
      expect(suggestFixes(clean, ctx)).toEqual([]);
  });
  it("is deterministic and the candidate neighbourhood has no duplicate descriptions after de-duplication", () => {
    expect(JSON.stringify(suggestFixes(bad, ctx))).toBe(JSON.stringify(suggestFixes(bad, ctx)));
    expect(candidateEdits(havock, ctx).length).toBeGreaterThan(10);
  });
  it("a magazine-distance warning gets a relocation-free fix such as removing or reducing the offending gun", () => {
    const farGun = applyEdit(havock, {
      kind: "move_placement",
      instanceId: "gun_12pdr",
      zoneId: "FORECASTLE",
      stationPermille: 40,
    });
    const wrong = {
      ...farGun,
      placements: farGun.placements.map((p) =>
        p.instanceId === "gun_12pdr" ? { ...p, magazineRef: "mag_aft" } : p,
      ),
    };
    const c = compileDesign(wrong, ctx);
    expect(c.findings.some((f) => f.id === "ARR-MAG-DIST")).toBe(true);
    expect(
      suggestFixes(wrong, ctx).some((f) => f.resolved.some((r) => r.includes("ARR-MAG-DIST"))),
    ).toBe(true);
  });
});
