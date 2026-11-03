import { describe, expect, it } from "vite-plus/test";
import { hidesStrip } from "./status-strip-start.js";

describe("hidesStrip", () => {
  it("replaces the strip with budget chips inside the design screen's own status bar", () => {
    expect(hidesStrip("ship-design")).toBe(true);
  });

  it("keeps the strip on every other screen", () => {
    expect(hidesStrip("overview")).toBe(false);
    expect(hidesStrip("strategic-map")).toBe(false);
    expect(hidesStrip("fleet")).toBe(false);
    expect(hidesStrip("construction")).toBe(false);
  });
});
