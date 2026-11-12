import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView, DESIGN_SCHEMA_VERSION } from "@bluewave/ship-design";
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
  it("carries the class name in the file, and opens an unnamed file with none", () => {
    const named = exportDesign(ref.draft, content.components, view.compiled, " Dido ");
    expect(importDesign(named, content.components)).toMatchObject({
      ok: true,
      className: "Dido",
      notes: [],
    });
    const unnamed = exportDesign(ref.draft, content.components, view.compiled);
    expect(importDesign(unnamed, content.components)).toMatchObject({
      ok: true,
      className: null,
    });
  });
  it("keeps the baseline the design was developed from, and opens an older file with none", () => {
    const text = exportDesign(ref.draft, content.components, view.compiled, "Dido", "Gunboat");
    expect(importDesign(text, content.components)).toMatchObject({
      ok: true,
      className: "Dido",
      baselineName: "Gunboat",
      notes: [],
    });
    const older = exportDesign(ref.draft, content.components, view.compiled, "Dido");
    expect(importDesign(older, content.components)).toMatchObject({
      ok: true,
      baselineName: null,
    });
  });
  it("can record every starting design's name, so Save never writes a file it cannot open", () => {
    for (const r of content.references) {
      const text = exportDesign(r.draft, content.components, view.compiled, "", r.name);
      expect(importDesign(text, content.components)).toMatchObject({
        ok: true,
        baselineName: r.name.trim(),
      });
    }
  });
  it("rejects garbage and foreign files with a message, never a throw", () => {
    for (const bad of ["", "not json", "{}", '{"format":"other","schemaVersion":1}'])
      expect(importDesign(bad, content.components)).toMatchObject({ ok: false });
  });
  it("rejects a file from a newer schema version", () => {
    const text = exportDesign(ref.draft, content.components, view.compiled).replace(
      `"schemaVersion":${DESIGN_SCHEMA_VERSION}`,
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
    const first = exportDesign(ref.draft, content.components, view.compiled);
    const second = exportDesign(ref.draft, content.components, view.compiled);
    expect(first).toBe(second);
    expect(importDesign(first, content.components)).toMatchObject({ ok: true, notes: [] });
  });
});
