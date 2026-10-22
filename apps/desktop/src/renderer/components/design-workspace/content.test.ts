import { legacyCatalogueView } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { catalogueView, loadDrawingBoardContent } from "./content.js";

describe("drawing-board catalogue view (17b-1)", () => {
  it("builds the read-only catalogue from the parts, equal to the legacy projection", () => {
    const content = loadDrawingBoardContent();
    expect(catalogueView(content.components, content.partModel)).toEqual(
      legacyCatalogueView(content.components),
    );
    expect(content.catalogue).toEqual(legacyCatalogueView(content.components));
  });

  it("falls back to the legacy projection when the pack carries no part model", () => {
    const content = loadDrawingBoardContent();
    expect(catalogueView(content.components, undefined)).toEqual(
      legacyCatalogueView(content.components),
    );
  });
});
