import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Compiler,
  baseGrowthFromRulesets,
  buildFullSurfaceInput,
} from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { isGrowthRateInBand } from "../src/economy.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const contentDir = resolve(here, "..", "..", "..", "content", "production", "1880");

const collector = new DiagnosticCollector();
const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
const output = new Compiler().compile(input!, new AbortController().signal, collector);
const bundle = output!.bundle;
const decoded = baseGrowthFromRulesets(bundle.rulesets);
if (decoded === undefined || !decoded.ok) {
  throw new Error("the production pack must carry a valid baseGrowth section");
}
const rules = decoded.value;
const nationIds = (bundle.nations as readonly { readonly id: string }[]).map((nation) => nation.id);

describe("production baseGrowth section (S-3 D7, #1115)", () => {
  it("compiles without error diagnostics", () => {
    expect(collector.all.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("authors only nations the pack defines", () => {
    for (const nationId of Object.keys(rules.nations)) expect(nationIds).toContain(nationId);
  });

  it("keeps every authored rate inside the manual band", () => {
    for (const [nationId, rate] of Object.entries(rules.nations)) {
      expect(isGrowthRateInBand(rate.annualGrowthBp), nationId).toBe(true);
    }
  });

  it("cites a titled source and a note for every authored rate", () => {
    for (const [nationId, rate] of Object.entries(rules.nations)) {
      expect(rate.provenance.sources.length, nationId).toBeGreaterThan(0);
      for (const source of rate.provenance.sources)
        expect(source.title.trim(), nationId).not.toBe("");
      expect((rate.provenance.note ?? "").trim(), nationId).not.toBe("");
      expect(rate.provenance.sourceStatus, nationId).not.toBe("PLACEHOLDER");
    }
  });

  it("cites the manual growth statement on every rate", () => {
    for (const [nationId, rate] of Object.entries(rules.nations)) {
      const manual = rate.provenance.sources.find((s) =>
        s.title.includes("Rule the Waves 3 manual"),
      );
      expect(manual?.page, nationId).toBe("12");
    }
  });
});
