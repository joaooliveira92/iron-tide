import { describe, it, expect } from "vite-plus/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { compileDesign, type DesignDraft } from "../src/index.js";
import { computeCve, CVE_LABEL } from "../src/cve.js";
import { ctx, draft, plant, cveBalance } from "./fixtures/gunboat.js";

const score = (d: DesignDraft, c = ctx) =>
  computeCve(compileDesign(d, c), d, plant.reliabilityBp, cveBalance);

describe("computeCve", () => {
  const base = score(draft);
  it("is labelled a development metric and bounded", () => {
    expect(base.label).toBe(CVE_LABEL);
    expect(CVE_LABEL).toContain("not a combat result");
    for (const v of [
      base.offenceBp,
      base.protectionBp,
      base.mobilityBp,
      base.reliabilityBp,
      base.suitabilityBp,
      base.cveBp,
    ]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10_000);
    }
    expect(base.cveBp).toBeGreaterThan(0);
  });
  it("is deterministic", () => {
    expect(score(draft)).toEqual(base);
  });
  it("more power raises mobility, more guns raise offence, thicker deck raises protection", () => {
    expect(
      score({ ...draft, machinery: { ...draft.machinery, installedKw: 4_000 } }).mobilityBp,
    ).toBeGreaterThan(base.mobilityBp);
    const moreGuns = {
      ...draft,
      placements: draft.placements.map((p) =>
        p.instanceId === "a_gun_fwd" ? { ...p, params: { barrels: 2, rounds: 100 } } : p,
      ),
    };
    expect(score(moreGuns).offenceBp).toBeGreaterThan(base.offenceBp);
    const thick = {
      ...draft,
      armour: {
        ...draft.armour,
        regions: draft.armour.regions.map((r) =>
          r.region === "DECK_MAIN" ? { ...r, thicknessUm: 60_000 } : r,
        ),
      },
    };
    expect(score(thick).protectionBp).toBeGreaterThan(base.protectionBp);
  });
  it("an invalid design has zero mission suitability and a lower score", () => {
    const bad = { ...draft, machinery: { ...draft.machinery, fuelCapacityKg: 400_000 } };
    const s = score(bad);
    expect(s.suitabilityBp).toBe(0);
    expect(s.cveBp).toBeLessThan(base.cveBp);
  });
  it("fails loudly on missing or malformed weights", () => {
    expect(() =>
      computeCve(compileDesign(draft, ctx), draft, 9_000, { ...cveBalance, weightsByCategory: {} }),
    ).toThrow();
    expect(() =>
      computeCve(compileDesign(draft, ctx), draft, 9_000, {
        ...cveBalance,
        weightsByCategory: {
          DD: {
            offence: 1,
            protection: 1,
            mobility: 1,
            reliability: 1,
            suitability: 1,
          },
        },
      }),
    ).toThrow();
  });
  it("AC-15: the combat package never imports ship-design", () => {
    const root = join(__dirname, "..", "..", "combat", "src");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
      });
    for (const f of walk(root)) expect(readFileSync(f, "utf8"), f).not.toContain("ship-design");
  });
});
