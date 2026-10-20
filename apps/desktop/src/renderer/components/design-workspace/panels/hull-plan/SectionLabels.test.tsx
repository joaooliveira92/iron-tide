import { describe, expect, it } from "vite-plus/test";
import { labelPlacement } from "./SectionLabels.js";

describe("labelPlacement", () => {
  it("centres a label on its section but holds the stern end inside the row", () => {
    const { left, width } = labelPlacement({ leftPct: 90, widthPct: 10 });
    // Centre at 95%, but never closer than the label's half-room to the right edge.
    expect(left).toBe("min(95%, calc(100% - max(5%, 3.25rem)))");
    expect(width).toBe("max(10%, 2.75rem)");
  });

  it("rounds away floating-point noise in the percentages", () => {
    expect(labelPlacement({ leftPct: 0, widthPct: 7.199999999999999 }).width).toBe(
      "max(7.2%, 2.75rem)",
    );
  });
});
