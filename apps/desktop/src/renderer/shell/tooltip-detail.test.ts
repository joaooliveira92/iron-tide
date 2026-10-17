import { describe, expect, it } from "vite-plus/test";

import { shouldShowTooltip, tooltipTitle } from "./tooltip-detail.js";

describe("tooltip detail (U-4 ticket 05)", () => {
  it("suppresses the tooltip only at `minimal`", () => {
    expect(shouldShowTooltip("minimal")).toBe(false);
    expect(shouldShowTooltip("standard")).toBe(true);
    expect(shouldShowTooltip("detailed")).toBe(true);
  });

  it("returns the title or undefined", () => {
    expect(tooltipTitle("standard", "Overview")).toBe("Overview");
    expect(tooltipTitle("minimal", "Overview")).toBeUndefined();
  });
});
