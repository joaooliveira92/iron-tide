import { describe, expect, it } from "vite-plus/test";
import { defaultCampaignSeed } from "./campaign-seed.js";

describe("defaultCampaignSeed", () => {
  it("produces a 32-char lowercase hex seed the engine contract accepts", () => {
    const seed = defaultCampaignSeed();
    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces a different seed each call", () => {
    expect(defaultCampaignSeed()).not.toBe(defaultCampaignSeed());
  });
});
