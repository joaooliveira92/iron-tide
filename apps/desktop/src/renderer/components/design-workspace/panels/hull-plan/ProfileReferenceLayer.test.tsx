import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { stationX } from "./geometry.js";
import { profileFrame } from "./profile-geometry.js";
import { ProfileReferenceLayer } from "./ProfileReferenceLayer.js";

const frame = profileFrame(
  { lengthWl: 85_000, beam: 12_000, draught: 4_200, depthToMainDeck: 7_000 } as never,
  11_000,
  "ram",
  "counter",
);
const draw = () =>
  render(
    <svg>
      <ProfileReferenceLayer frame={frame} />
    </svg>,
  );

describe("ProfileReferenceLayer", () => {
  it("is decorative and groups the reference geometry", () => {
    const { container } = draw();
    const group = container.querySelector("[data-testid='profile-datums']")!;
    expect(group.getAttribute("aria-hidden")).toBe("true");
  });

  it("rules a baseline from bow to stern", () => {
    const { container } = draw();
    const baseline = Array.from(container.querySelectorAll("line")).find(
      (l) =>
        l.getAttribute("x1") === String(stationX(0)) &&
        l.getAttribute("x2") === String(stationX(1000)),
    )!;
    expect(Number(baseline.getAttribute("y1"))).toBeCloseTo(frame.keelBaseY + 4, 6);
  });

  it("ticks every station below the baseline, major stations longer", () => {
    const { container } = draw();
    const baselineY = frame.keelBaseY + 4;
    const ticks = Array.from(container.querySelectorAll("line")).filter(
      (l) =>
        l.getAttribute("x1") === l.getAttribute("x2") && Number(l.getAttribute("y1")) === baselineY,
    );
    expect(ticks).toHaveLength(11);
    const length = (x: number) => {
      const tick = ticks.find((l) => Number(l.getAttribute("x1")) === stationX(x))!;
      return Number(tick.getAttribute("y2")) - Number(tick.getAttribute("y1"));
    };
    expect(length(0)).toBeGreaterThan(length(100));
  });

  it("dimensions the draught (T) and the depth (D)", () => {
    const { container } = draw();
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("T");
    expect(texts).toContain("D");
  });
});
