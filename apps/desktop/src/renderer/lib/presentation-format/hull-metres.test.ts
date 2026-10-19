import { describe, expect, it } from "vite-plus/test";
import { formatHullMetres } from "./hull-metres.js";

describe("hull dimension readout (the two sites moved out of HullPlanPanel)", () => {
  it("keeps the fixed decimals toFixed gave", () => {
    expect(formatHullMetres(12, 1)).toBe("12.0");
    expect(formatHullMetres(12.46, 1)).toBe("12.5");
    expect(formatHullMetres(129.6, 0)).toBe("130");
    expect(formatHullMetres(0, 1)).toBe("0.0");
  });
});
