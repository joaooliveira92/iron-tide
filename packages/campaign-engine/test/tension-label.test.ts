import { describe, expect, it } from "vite-plus/test";
import {
  HIGH_TENSION_THRESHOLD,
  TENSION_LABELS,
  isHighTension,
  tensionLabel,
} from "../src/diplomacy.js";

describe("tensionLabel", () => {
  it("returns war_imminent at and above TENSION_WAR (10)", () => {
    expect(tensionLabel(10)).toBe("war_imminent");
    expect(tensionLabel(12)).toBe("war_imminent");
  });

  it("returns hostile from the high-tension threshold up to war-imminent", () => {
    expect(tensionLabel(HIGH_TENSION_THRESHOLD)).toBe("hostile");
    expect(tensionLabel(9)).toBe("hostile");
  });

  it("returns strained for 6..7", () => {
    expect(tensionLabel(6)).toBe("strained");
    expect(tensionLabel(7)).toBe("strained");
  });

  it("returns neutral around the peace baseline (3..5)", () => {
    expect(tensionLabel(5)).toBe("neutral");
    expect(tensionLabel(3)).toBe("neutral");
  });

  it("returns cordial below 3", () => {
    expect(tensionLabel(2)).toBe("cordial");
    expect(tensionLabel(0)).toBe("cordial");
  });

  it("produces every label in the taxonomy across the real 0..10 scale", () => {
    const produced = new Set<string>();
    for (let t = 0; t <= 10; t += 1) {
      produced.add(tensionLabel(t));
    }
    expect(produced).toEqual(
      new Set(["cordial", "neutral", "strained", "hostile", "war_imminent"]),
    );
    expect(TENSION_LABELS).toEqual(["cordial", "neutral", "strained", "hostile", "war_imminent"]);
  });
});

describe("isHighTension", () => {
  it("is true at and above the threshold, false below", () => {
    expect(isHighTension(HIGH_TENSION_THRESHOLD)).toBe(true);
    expect(isHighTension(9)).toBe(true);
    expect(isHighTension(HIGH_TENSION_THRESHOLD - 1)).toBe(false);
    expect(isHighTension(0)).toBe(false);
  });

  it("agrees with the label reaching hostile", () => {
    for (let t = 0; t <= 12; t += 1) {
      const label = tensionLabel(t);
      expect(isHighTension(t)).toBe(label === "hostile" || label === "war_imminent");
    }
  });
});
