import { describe, expect, it, vi } from "vite-plus/test";
import { PLAYABLE_SLOT_COUNTRY_IDS } from "@/content/nationAssetManifest.js";
import { globePins } from "./globePins.js";

describe("globePins", () => {
  it("can be imported before presentation content arrives from the main process", async () => {
    vi.resetModules();
    const { hasPresentationContent } = await import("@/content/presentationContent.js");
    expect(hasPresentationContent()).toBe(false);

    await expect(import("./globePins.js")).resolves.toBeDefined();
  });

  it("describes every playable nation once content is loaded", () => {
    const { points, colors } = globePins();

    expect(points.map((point) => point.countryId)).toEqual([...PLAYABLE_SLOT_COUNTRY_IDS]);
    for (const point of points) expect(colors[point.countryId]).toBe(point.flagColor);
  });
});
