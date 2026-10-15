import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "./content.js";
import { designFileName, exportDesign, importDesign } from "./designFile.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));

describe("design files", () => {
  it("round-trips a draft exactly", () => {
    const text = exportDesign(ref.draft, content.components, view.compiled);
    const r = importDesign(text, content.components);
    expect(r).toMatchObject({ ok: true, notes: [] });
    if (r.ok) expect(r.draft).toEqual(ref.draft);
  });
  it("rejects garbage and foreign files with a message, never a throw", () => {
    for (const bad of ["", "not json", "{}", '{"format":"other","schemaVersion":1}'])
      expect(importDesign(bad, content.components)).toMatchObject({ ok: false });
  });
  it("rejects a file from a newer schema version", () => {
    const text = exportDesign(ref.draft, content.components, view.compiled).replace(
      '"schemaVersion":1',
      '"schemaVersion":99',
    );
    expect(importDesign(text, content.components)).toMatchObject({ ok: false });
  });
  it("reports content drift when a used component definition changed", () => {
    const text = exportDesign(ref.draft, content.components, view.compiled);
    const usedId = ref.draft.placements[0]!.componentId;
    const changed = content.components.map((c) =>
      c.id === usedId ? { ...c, displayName: `${c.displayName}!` } : c,
    );
    const r = importDesign(text, changed);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.notes.join(" ")).toContain(usedId);
  });
  it("makes safe file names", () => {
    expect(designFileName("  Torpedo Cruiser / 1880! ")).toBe("torpedo-cruiser-1880.bwdesign");
    expect(designFileName("???")).toBe("design.bwdesign");
  });
  it("keeps a stable component identity across export/import (17b-2)", () => {
    // The parts-derived catalogue is authoritative for the designer, but design-file identity
    // keeps hashing the legacy components: the same draft encodes byte-identically and imports
    // with no drift, so a saved design's identity is stable across the catalogue migration.
    const first = exportDesign(ref.draft, content.components, view.compiled);
    const second = exportDesign(ref.draft, content.components, view.compiled);
    expect(first).toBe(second);
    expect(importDesign(first, content.components)).toMatchObject({ ok: true, notes: [] });
  });
});
