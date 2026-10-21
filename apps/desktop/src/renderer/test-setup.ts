import { configure } from "@testing-library/react";
import { beforeEach, vi } from "vite-plus/test";

import { loadShipBuildingData } from "../main/shipBuildingContent.js";
import { loadUiCatalogue } from "../main/uiCatalogue.js";
import { loadPresentationContent } from "../main/presentationContent.js";
// The seam module directly, not the barrel: loading the whole layer here would cache it before a
// test file's `vi.mock` of one of its dependencies takes effect.
import { setDrawingBoardContent } from "./components/design-workspace/content.js";
import { setPresentationContent } from "./content/presentationContent.js";
import { setUiCatalogue } from "./content/uiCatalogue.js";

/**
 * Renderer tests inject decoded content instead of parsing raw YAML (ticket 04,
 * CRI-IPC-4): seed the drawing board's content seam from the compiled artifact
 * the vitest global setup produced. In the app the same DTO arrives over the
 * `inspectDrawingBoardContent` IPC; here it comes from the shared main loader so
 * tests render exactly the content the compiler validated.
 */
setDrawingBoardContent({ catalogue: loadShipBuildingData() });

/**
 * The presentation corpus (CAH-PRES-3) is decoded by main from the same
 * artifact; seed the renderer seam from the main loader so screens and the pure
 * view-models read exactly the content the compiler validated. In the app the
 * DTO arrives over `inspectPresentationContent` via `PresentationContentGate`.
 */
setPresentationContent(loadPresentationContent());

/**
 * The UI-string catalogue (ADR-0209/ADR-0218) is decoded by main from the same artifact and ships over `inspectUiCatalogue`;
 * seed the renderer seam from the main loader so every dialog and message renders the strings the pack authors, including
 * the battle-offer set (T-1 09). Re-seeded before every test so one test's own catalogue never leaks into the next.
 */
const PRODUCTION_UI_CATALOGUE = loadUiCatalogue();
beforeEach(() => setUiCatalogue(PRODUCTION_UI_CATALOGUE));

/**
 * Testing Library's default async wait is 1s. Under the full suite, files run in parallel and
 * a lazily loaded chunk (the map and its coastline) or a multi-step flow can take longer than
 * that on a busy machine, which showed up as unrelated tests failing intermittently. 5s is
 * long enough for a loaded machine and still short enough that a genuine hang fails promptly.
 */
configure({ asyncUtilTimeout: 5000 });

/** jsdom has no ResizeObserver; components that measure themselves (liquid-glass) need a no-op. */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

/** jsdom has no Element.scrollIntoView either; the select scrolls its active option into view. */
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * The "this change breaks the design" dialog is modal, and many tests make deliberately heavy edits (armour, extra
 * mounts) to check something else; it would sit over the screen they inspect. It renders nothing by default; the
 * tests that cover it call `vi.unmock` on this module.
 */
vi.mock("./components/design-workspace/ChoiceProblemDialog.js", () => ({
  ChoiceProblemDialog: () => null,
}));
