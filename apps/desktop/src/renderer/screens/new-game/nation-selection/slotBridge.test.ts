import { describe, expect, it } from "vite-plus/test";
import { presentationNations } from "@/content/presentationContent.js";
import { countryIdToNationId, nationIdToCountryId } from "./slotBridge.js";

describe("slotBridge", () => {
  it("maps every playable content-pack nation id to a presentation country id", () => {
    expect(nationIdToCountryId("uk")).toBe("gb");
    expect(nationIdToCountryId("germany")).toBe("de");
    expect(nationIdToCountryId("france")).toBe("fr");
    expect(nationIdToCountryId("italy")).toBe("it");
  });

  it("round-trips every authored nation record through countryIdToNationId", () => {
    for (const nation of presentationNations()) {
      expect(countryIdToNationId(nation.countryId)).toBe(nation.nationId);
      expect(nationIdToCountryId(nation.nationId)).toBe(nation.countryId);
    }
  });

  it("returns null for unknown nation ids", () => {
    expect(nationIdToCountryId("atlantis")).toBeNull();
    expect(nationIdToCountryId("nation_uk")).toBeNull();
  });
});
