import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { arcSectors } from "./arcs.js";
import { SectionFittingOverlay } from "./SectionFittingOverlay.js";
import { SECTION_IDS, type SectionId } from "./sections.js";
import { frame, sectionFactsFor, sectionLayoutFor } from "./test-fixtures.js";

const factsFor = (id: SectionId) => sectionFactsFor(id);
/** A section that actually has fittings to draw. */
const FITTED = SECTION_IDS.find((id) => factsFor(id).fittings.length > 0)!;

const draw = (id: SectionId) => {
  const facts = factsFor(id);
  const layout = sectionLayoutFor(id)!;
  const { container } = render(
    <svg>
      <defs>
        <clipPath id="overlay-plan">
          <rect x={0} y={0} width={10} height={10} />
        </clipPath>
      </defs>
      <SectionFittingOverlay layout={layout} frame={frame} facts={facts} clip="overlay-plan" />
    </svg>,
  );
  return { container, facts };
};

describe("SectionFittingOverlay", () => {
  it("places every fitting in the section, numbered, with a symbol per kind", () => {
    expect(FITTED).toBeDefined();
    const { container, facts } = draw(FITTED);
    const groups = Array.from(container.querySelectorAll("[data-fitting]"));
    expect(groups).toHaveLength(facts.fittings.length);
    groups.forEach((g, i) => {
      expect(g.getAttribute("data-fitting")).toBe(facts.fittings[i]!.instanceId);
      expect(g.getAttribute("data-kind")).toBe(facts.fittings[i]!.kind);
      expect(g.querySelector("circle, rect, polygon")).not.toBeNull();
      expect(g.querySelector("text")!.textContent).toBe(String(facts.fittings[i]!.n));
    });
  });

  it("draws a gun's beam arc wedge over everything else", () => {
    const withArc = SECTION_IDS.flatMap((id) =>
      factsFor(id)
        .fittings.filter((f) => f.kind === "gun" && f.arcDeg !== undefined)
        .map((f) => ({ id, f })),
    )[0]!;
    expect(withArc).toBeDefined();
    const expected = arcSectors(withArc.f.instanceId, withArc.f.side, withArc.f.arcDeg).length;
    const { container } = draw(withArc.id);
    const group = container.querySelector(`[data-fitting='${withArc.f.instanceId}']`)!;
    expect(group.querySelectorAll("path")).toHaveLength(expected);
    // The card magnifies the plan, so its schematic arc radius is its own (26, vs the main plan's 30).
    expect(group.querySelector("path")!.getAttribute("d")).toMatch(/A 26 26/);
  });
});
