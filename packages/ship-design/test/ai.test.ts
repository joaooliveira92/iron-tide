import { describe, it, expect } from "vite-plus/test";
import { generateCandidates, compileDesign } from "../src/index.js";
import { ARCHETYPE_IDS, type AiRequest } from "../src/ai.js";
import { aiEnv, ctx, draft } from "./fixtures/gunboat.js";

const req = (seed: string, o: Partial<AiRequest> = {}): AiRequest => ({
  base: draft,
  seed,
  nationKey: "uk",
  candidates: 4,
  compilesPerArchetype: 60,
  ...o,
});

describe("generateCandidates", () => {
  const out = generateCandidates(aiEnv, req("seed-A"));
  it("returns up to the requested number of candidates, each fully valid under the player's compiler", () => {
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.candidates.length).toBeLessThanOrEqual(4);
    for (const c of out.candidates) {
      expect(c.compiled.valid).toBe(true);
      expect(c.compiled.findings.some((f) => f.severity === "BLOCKING")).toBe(false);
      const again = compileDesign(c.draft, ctx);
      expect(again.hash).toBe(c.compiled.hash);
      expect(c.explanation).toContain("development metric");
    }
  });
  it("candidates are pairwise distinct designs", () => {
    const hashes = out.candidates.map((c) => c.compiled.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
  it("respects the compile budget (no hidden extra search) and records one decision per archetype", () => {
    expect(out.compilesUsed).toBeLessThanOrEqual(ARCHETYPE_IDS.length * (60 + 1));
    expect(out.ledger.all).toHaveLength(ARCHETYPE_IDS.length);
    expect(
      out.ledger.all.every(
        (d) => d.phase === "AI_DESIGN" && d.streamId.startsWith("shipbuilding.ai:uk:"),
      ),
    ).toBe(true);
  });
  it("same seed gives the same set; different seeds explore differently", () => {
    const again = generateCandidates(aiEnv, req("seed-A"));
    expect(again.candidates.map((c) => c.compiled.hash)).toEqual(
      out.candidates.map((c) => c.compiled.hash),
    );
    expect(again.ledger.hash()).toBe(out.ledger.hash());
    const other = generateCandidates(aiEnv, req("seed-B"));
    expect(other.candidates.map((c) => c.compiled.hash)).not.toEqual(
      out.candidates.map((c) => c.compiled.hash),
    );
  });
  it("archetypes start from their own doctrine margin and end in different designs", () => {
    const all = generateCandidates(
      aiEnv,
      req("seed-C", { candidates: 6, compilesPerArchetype: 80 }),
    );
    const byArch = new Map(all.candidates.map((c) => [c.archetype, c]));
    expect(all.candidates.length).toBeGreaterThanOrEqual(3);
    expect(new Set(all.candidates.map((c) => c.compiled.hash)).size).toBe(all.candidates.length);
    const agg = byArch.get("AGGRESSIVE");
    const con = byArch.get("CONSERVATIVE");
    if (agg && con)
      expect(agg.draft.hull.designMarginBp).toBeLessThan(con.draft.hull.designMarginBp);
  });
  it("never returns an illegal ship over many seeds", () => {
    for (let i = 0; i < 8; i++) {
      for (const c of generateCandidates(aiEnv, req(`fuzz-${i}`, { compilesPerArchetype: 30 }))
        .candidates) {
        expect(c.compiled.valid).toBe(true);
      }
    }
  });
  it("a budget too small for anything yields candidates that still pass validation or none", () => {
    const poor = generateCandidates(
      { ...aiEnv, budgetMicro: 1_000_000 },
      req("seed-D", { compilesPerArchetype: 20 }),
    );
    for (const c of poor.candidates) expect(c.compiled.valid).toBe(true);
  });
  it("an invalid starting draft is searched toward feasibility and any result is valid", () => {
    const bad = { ...draft, machinery: { ...draft.machinery, fuelCapacityKg: 400_000 } };
    const r = generateCandidates(aiEnv, req("seed-E", { base: bad, compilesPerArchetype: 100 }));
    for (const c of r.candidates) expect(c.compiled.valid).toBe(true);
  });
});
