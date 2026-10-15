import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { SectionProfileBand } from "./SectionProfileBand.js";
import { SECTION_IDS, type SectionId } from "./sections.js";
import { profile, sectionFactsFor, sectionLayoutFor } from "./test-fixtures.js";

const factsFor = (id: SectionId) => sectionFactsFor(id);
const draw = (id: SectionId) => {
  const facts = factsFor(id);
  const layout = sectionLayoutFor(id)!;
  const { container } = render(
    <svg>
      <defs>
        <clipPath id="band-profile">
          <rect x={0} y={0} width={10} height={10} />
        </clipPath>
      </defs>
      <SectionProfileBand layout={layout} profile={profile} facts={facts} clip="band" />
    </svg>,
  );
  return { container, layout, facts };
};

describe("SectionProfileBand", () => {
  it("clips the main profile to the band over its design waterline", () => {
    const { container, layout } = draw("central-machinery");
    const clip = container.querySelector("g[clip-path='url(#band-profile)']")!;
    expect(clip.querySelector("[data-testid='profile-hull']")).not.toBeNull();
    const waterline = container.querySelector("[data-testid='section-waterline']")!;
    expect(Number(waterline.getAttribute("y1"))).toBeCloseTo(layout.pY(profile.waterlineY), 6);
  });

  it("marks each machinery room and each fitting in the section", () => {
    const { container, facts } = draw("central-machinery");
    expect(container.querySelectorAll("[data-testid='section-machinery-room']")).toHaveLength(
      facts.machineryRooms.length,
    );
    const fittingTicks = Array.from(container.querySelectorAll("line")).filter(
      (l) => l.getAttribute("stroke-width") === "2",
    );
    expect(fittingTicks).toHaveLength(facts.fittings.length);
  });

  it("marks the fuel stowage when the bunkers are in this section", () => {
    const fuelId = SECTION_IDS.find((id) => factsFor(id).fuelStationPermille !== undefined)!;
    expect(fuelId).toBeDefined();
    const { container } = draw(fuelId);
    expect(container.querySelector("[data-testid='section-fuel']")).not.toBeNull();
    const noFuel = SECTION_IDS.find((id) => factsFor(id).fuelStationPermille === undefined)!;
    expect(draw(noFuel).container.querySelector("[data-testid='section-fuel']")).toBeNull();
  });
});
