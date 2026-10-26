import { describe, expect, it } from "vite-plus/test";
import { monthsToCompletion } from "./research-eta.js";

describe("monthsToCompletion", () => {
  it("rounds the remaining work up to whole months", () => {
    expect(monthsToCompletion(60, 30, 20)).toBe(2);
    expect(monthsToCompletion(60, 30, 14)).toBe(3);
  });

  it("is zero for finished work and null when nothing is funded", () => {
    expect(monthsToCompletion(60, 60, 10)).toBe(0);
    expect(monthsToCompletion(60, 90, 10)).toBe(0);
    expect(monthsToCompletion(60, 10, 0)).toBeNull();
  });
});
