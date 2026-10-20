import { describe, expect, it } from "vite-plus/test";
import { formatFittingShare, formatFittingTonnes } from "./colonial-service.js";

describe("colonial-service fitting readout", () => {
  it("keeps the fixed decimals toFixed gave for tonnes and share", () => {
    expect(formatFittingTonnes(8_494)).toBe("8.5");
    expect(formatFittingTonnes(12_000)).toBe("12.0");
    expect(formatFittingShare(137)).toBe("1.37");
    expect(formatFittingShare(100)).toBe("1.00");
  });
});
