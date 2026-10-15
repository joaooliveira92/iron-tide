import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { PAD_X, SCALE_Y, SECTION_W } from "./section-drawing.js";
import { SectionScale } from "./SectionScale.js";
import { sectionLayoutFor } from "./test-fixtures.js";

const layout = sectionLayoutFor("aft-service")!;

describe("SectionScale", () => {
  it("ticks the documented step across the band", () => {
    const { container } = render(
      <svg>
        <SectionScale layout={layout} />
      </svg>,
    );
    const ticks = Array.from(container.querySelectorAll("line")).filter(
      (l) => l.getAttribute("x1") === l.getAttribute("x2"),
    );
    expect(ticks).toHaveLength(layout.ticks.length);
    expect(ticks.map((t) => Number(t.getAttribute("x1")))).toEqual(layout.ticks.map(layout.X));
  });

  it("rules a reference line and labels the section's two ends", () => {
    const { container } = render(
      <svg>
        <SectionScale layout={layout} />
      </svg>,
    );
    const rule = Array.from(container.querySelectorAll("line")).find(
      (l) =>
        l.getAttribute("x1") === String(PAD_X) &&
        l.getAttribute("x2") === String(SECTION_W - PAD_X),
    )!;
    expect(Number(rule.getAttribute("y1"))).toBe(SCALE_Y - 12);
    const labels = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(labels).toContain(`${layout.zone.startPermille}‰`);
    expect(labels).toContain(`${layout.zone.endPermille}‰`);
  });
});
