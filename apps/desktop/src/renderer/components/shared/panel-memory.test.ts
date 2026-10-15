import { afterEach, describe, expect, it } from "vite-plus/test";
import { readPanelOpen, writePanelOpen } from "./panel-memory.js";

describe("panel memory", () => {
  afterEach(() => sessionStorage.clear());

  it("uses the default until the player chooses", () => {
    expect(readPanelOpen("a", true)).toBe(true);
    expect(readPanelOpen("a", false)).toBe(false);
  });

  it("remembers an explicit choice over the default, per panel", () => {
    writePanelOpen("a", false);
    writePanelOpen("b", true);
    expect(readPanelOpen("a", true)).toBe(false);
    expect(readPanelOpen("b", false)).toBe(true);
    expect(readPanelOpen("c", true)).toBe(true);
  });
});
