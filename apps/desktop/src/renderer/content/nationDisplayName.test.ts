import { describe, expect, it } from "vite-plus/test";
import { nationDisplayName } from "./nationDisplayName.js";

describe("nationDisplayName", () => {
  it("resolves canonical nation ids to their canonical display names", () => {
    expect(nationDisplayName("uk")).toBe("United Kingdom");
    expect(nationDisplayName("germany")).toBe("German Empire");
    expect(nationDisplayName("france")).toBe("French Republic");
  });

  it("falls back to the raw id for an unmapped or unknown nation id", () => {
    expect(nationDisplayName("nation_uk")).toBe("nation_uk");
    expect(nationDisplayName("GBR")).toBe("GBR");
    expect(nationDisplayName("atlantis")).toBe("atlantis");
  });
});
