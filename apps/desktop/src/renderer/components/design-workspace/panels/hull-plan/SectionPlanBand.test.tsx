import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { DASH } from "./drafting.js";
import { SectionPlanBand } from "./SectionPlanBand.js";
import { content, frame, hullForm as form, reference, sectionLayoutFor } from "./test-fixtures.js";

const layout = sectionLayoutFor("central-machinery")!;

const draw = () =>
  render(
    <svg>
      <defs>
        <clipPath id="band-plan">
          <rect x={0} y={0} width={10} height={10} />
        </clipPath>
      </defs>
      <SectionPlanBand
        layout={layout}
        frame={frame}
        draft={reference.draft}
        content={content}
        zones={form.zones}
        clip="band"
      />
    </svg>,
  );

describe("SectionPlanBand", () => {
  it("draws the main hull, superstructure and funnels under the card transform", () => {
    const { container } = draw();
    const clip = container.querySelector("g[clip-path]")!;
    expect(clip.getAttribute("clip-path")).toBe("url(#band-plan)");
    const transformed = clip.querySelector("g[transform]")!;
    expect(transformed.getAttribute("transform")).toContain(String(layout.a));
    expect(transformed.querySelector("[data-testid='hull-outline']")).not.toBeNull();
    expect(transformed.querySelector("[data-testid='hull-superstructure']")).not.toBeNull();
  });

  it("overlays a dashed centreline across the band", () => {
    const { container } = draw();
    const centreline = Array.from(container.querySelectorAll("line")).find(
      (l) => l.getAttribute("stroke-dasharray") === DASH.centreline,
    )!;
    expect(Number(centreline.getAttribute("y1"))).toBeCloseTo(layout.planCy, 6);
    expect(Number(centreline.getAttribute("y2"))).toBeCloseTo(layout.planCy, 6);
  });
});
