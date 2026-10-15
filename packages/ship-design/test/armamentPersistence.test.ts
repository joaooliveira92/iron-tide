import { describe, expect, it } from "vite-plus/test";
import { compileDesign, decodeDesignFile, encodeDesignFile } from "../src/index.js";
import { nationalContext, shipBuildingContent } from "./helpers/earlyContext.js";

const starter = shipBuildingContent.starterDesigns.find(
  (s) => s.draft.nationId === "uk" && s.month === "1880-01",
)!;

describe("armament-aware persistence (ADR-0093 Step 3)", () => {
  it("loads an old save that stores only legacy component ids and compiles it through armament", () => {
    const ctx = nationalContext(starter.month, starter.draft.nationId);
    // A legacy design file: placements name the shared family component id, as before the cut-over.
    const text = encodeDesignFile(starter.draft, ctx.catalogue, null);
    const decoded = decodeDesignFile(text, ctx.catalogue);
    expect(decoded.draft).toEqual(starter.draft);
    expect(decoded.contentDrift).toEqual([]);
    const compiled = compileDesign(decoded.draft, ctx);
    expect(compiled.valid).toBe(true);
    expect(compiled.components.some((c) => c.armament !== undefined)).toBe(true);
  });

  it("round-trips a new save with a stable compiled identity", () => {
    const ctx = nationalContext(starter.month, starter.draft.nationId);
    const compiled = compileDesign(starter.draft, ctx);
    const text = encodeDesignFile(starter.draft, ctx.catalogue, compiled);
    const decoded = decodeDesignFile(text, ctx.catalogue);
    expect(decoded.compiledHash).toBe(compiled.hash);
    expect(compileDesign(decoded.draft, ctx).hash).toBe(compiled.hash);
    expect(encodeDesignFile(decoded.draft, ctx.catalogue, compiled)).toBe(text);
  });

  it("keeps the save schema version unchanged (no forced migration)", () => {
    const ctx = nationalContext(starter.month, starter.draft.nationId);
    const text = encodeDesignFile(starter.draft, ctx.catalogue, null);
    const decoded = decodeDesignFile(text, ctx.catalogue);
    expect(decoded.migratedFrom).toBeNull();
  });
});
