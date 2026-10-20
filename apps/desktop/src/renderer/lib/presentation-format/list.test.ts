import { describe, expect, it } from "vite-plus/test";
import { formatConjunctionList } from "./index.js";

describe("formatConjunctionList", () => {
  it("joins one, two and many items", () => {
    expect(formatConjunctionList(["Qing"])).toBe("Qing");
    expect(formatConjunctionList(["Qing", "Russia"])).toBe("Qing and Russia");
    expect(formatConjunctionList(["Qing", "Russia", "UK"])).toBe("Qing, Russia, and UK");
  });
});
