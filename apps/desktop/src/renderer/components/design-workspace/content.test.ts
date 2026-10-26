import { legacyCatalogueView } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { catalogueView, loadDrawingBoardContent } from "./content.js";

describe("drawing-board catalogue view (17b-1)", () => {
  it("builds the read-only catalogue from the parts, equal to the legacy projection for legacy ids", () => {
    const content = loadDrawingBoardContent();
    const legacyIds = new Set(content.components.map((component) => component.id));
    const legacy = legacyCatalogueView(content.components);
    expect(
      catalogueView(content.components, content.partModel).filter((e) => legacyIds.has(e.id)),
    ).toEqual(legacy);
    expect(content.catalogue.filter((e) => legacyIds.has(e.id))).toEqual(legacy);
    expect(content.catalogue.map((e) => e.id)).toEqual(
      expect.arrayContaining(["rad_type_286_search", "rad_type_284_fire_control"]),
    );
  });

  it("falls back to the legacy projection when the pack carries no part model", () => {
    const content = loadDrawingBoardContent();
    expect(catalogueView(content.components, undefined)).toEqual(
      legacyCatalogueView(content.components),
    );
  });
});
