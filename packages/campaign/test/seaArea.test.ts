import { describe, expect, it } from "vite-plus/test";
import { isSeaArea } from "../src/seaArea.js";

const area = (type: "land" | "sea" | "coastal") => ({ id: `a_${type}`, name: type, type });

describe("isSeaArea", () => {
  it("rejects land", () => {
    expect(isSeaArea(area("land"))).toBe(false);
  });

  it("accepts open sea", () => {
    expect(isSeaArea(area("sea"))).toBe(true);
  });

  it("accepts coastal areas as sea", () => {
    expect(isSeaArea(area("coastal"))).toBe(true);
  });
});
