import type { DesignDraft } from "@bluewave/ship-design";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { GunArcLayer } from "./fitting-layers.js";
import { planFrame } from "./geometry.js";
import { SectionFittingOverlay } from "./SectionFittingOverlay.js";
import { SECTION_IDS } from "./sections.js";
import { frame, sectionFactsFor, sectionLayoutFor } from "./test-fixtures.js";

const radiusOf = (path: Element) => {
  const m = /A (\d+(?:\.\d+)?) /.exec(path.getAttribute("d") ?? "");
  if (m === null) throw new Error("no arc command in path");
  return Number(m[1]);
};

const PLAN_RADIUS = 30;
const CARD_RADIUS = 26;

describe("gun arc radii", () => {
  it("the main plan draws arcs at radius 30", () => {
    const draft = {
      placements: [
        { instanceId: "mount", componentId: "gun", zoneId: "FORECASTLE", stationPermille: 300 },
      ],
    } as unknown as DesignDraft;
    const planFrameSynthetic = planFrame({ lengthWl: 100_000, beam: 14_000 } as never);
    const { container } = render(
      <svg>
        <GunArcLayer
          frame={planFrameSynthetic}
          draft={draft}
          mounts={[{ instanceId: "mount", effectiveBeamArcDeg: 120 }]}
        />
      </svg>,
    );
    expect(radiusOf(container.querySelector("[data-arc]")!)).toBe(PLAN_RADIUS);
  });

  it("the section card draws arcs at its own radius 26", () => {
    const withArc = SECTION_IDS.flatMap((id) =>
      sectionFactsFor(id)
        .fittings.filter((f) => f.kind === "gun" && f.arcDeg !== undefined)
        .map((f) => ({ id, f })),
    )[0]!;
    const layout = sectionLayoutFor(withArc.id)!;
    const { container } = render(
      <svg>
        <defs>
          <clipPath id="radius-plan">
            <rect x={0} y={0} width={10} height={10} />
          </clipPath>
        </defs>
        <SectionFittingOverlay
          layout={layout}
          frame={frame}
          facts={sectionFactsFor(withArc.id)}
          clip="radius-plan"
        />
      </svg>,
    );
    const path = container.querySelector(`[data-fitting='${withArc.f.instanceId}'] path`)!;
    expect(radiusOf(path)).toBe(CARD_RADIUS);
  });
});
