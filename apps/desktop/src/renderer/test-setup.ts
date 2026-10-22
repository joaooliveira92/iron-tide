import { configure } from "@testing-library/react";
import { beforeEach, vi } from "vite-plus/test";

import { loadShipBuildingData } from "../main/shipBuildingContent.js";
import { loadUiCatalogue } from "../main/uiCatalogue.js";
import { loadPresentationContent } from "../main/presentationContent.js";
import { setDrawingBoardContent } from "./components/design-workspace/content.js";
import { setPresentationContent } from "./content/presentationContent.js";
import { setUiCatalogue } from "./content/uiCatalogue.js";

setDrawingBoardContent({ catalogue: loadShipBuildingData() });

setPresentationContent(loadPresentationContent());

const PRODUCTION_UI_CATALOGUE = loadUiCatalogue();
beforeEach(() => setUiCatalogue(PRODUCTION_UI_CATALOGUE));

configure({ asyncUtilTimeout: 5000 });

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock("./components/design-workspace/ChoiceProblemDialog.js", () => ({
  ChoiceProblemDialog: () => null,
}));
