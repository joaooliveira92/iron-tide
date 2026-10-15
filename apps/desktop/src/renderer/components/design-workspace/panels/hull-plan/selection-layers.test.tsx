import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { DASH, STROKE } from "./drafting.js";
import { PLAN_MID, planFrame } from "./geometry.js";
import { MachineryRoomMarker, SectionHighlightLayer } from "./selection-layers.js";

const frame = planFrame({ lengthWl: 100_000, beam: 14_000 } as never);
const zone = { id: "FWD_SERVICE", startPermille: 100, endPermille: 500 };
const draw = (ui: React.ReactNode) => render(<svg>{ui}</svg>);

describe("SectionHighlightLayer", () => {
  it("draws nothing when the hull form has no zone for the section", () => {
    const { container } = draw(
      <SectionHighlightLayer frame={frame} zone={undefined} variant="selected" />,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("spans the zone's stations, a little wider than the hull, and is decorative", () => {
    const { container } = draw(<SectionHighlightLayer frame={frame} zone={zone} />);
    const rect = container.querySelector("rect")!;
    expect(Number(rect.getAttribute("x"))).toBeCloseTo(frame.x(100), 6);
    expect(Number(rect.getAttribute("width"))).toBeCloseTo(frame.x(500) - frame.x(100), 6);
    expect(Number(rect.getAttribute("y"))).toBeCloseTo(PLAN_MID - frame.maxHalf - 4, 6);
    expect(Number(rect.getAttribute("height"))).toBeCloseTo(frame.maxHalf * 2 + 8, 6);
    expect(rect.getAttribute("data-zone")).toBe("FWD_SERVICE");
    expect(rect.getAttribute("aria-hidden")).toBe("true");
  });

  it("differs in dash, width and fill per state, so the state reads without colour", () => {
    const { container } = draw(
      <>
        <SectionHighlightLayer frame={frame} zone={zone} variant="preview" />
        <SectionHighlightLayer frame={frame} zone={zone} variant="linked" />
        <SectionHighlightLayer frame={frame} zone={zone} variant="selected" />
      </>,
    );
    const [preview, linked, selected] = Array.from(container.querySelectorAll("rect"));
    expect(preview!.getAttribute("data-testid")).toBe("section-highlight");
    expect(preview!.getAttribute("stroke-dasharray")).toBe(DASH.zoneGuide);
    expect(linked!.getAttribute("data-testid")).toBe("section-linked");
    expect(linked!.getAttribute("stroke-dasharray")).toBe("1 3");
    expect(Number(linked!.getAttribute("fill-opacity"))).toBe(0);
    expect(selected!.getAttribute("data-testid")).toBe("section-selected");
    expect(selected!.getAttribute("stroke-dasharray")).toBeNull();
    expect(Number(selected!.getAttribute("stroke-width"))).toBe(2.2);
    expect(Number(selected!.getAttribute("fill-opacity"))).toBeGreaterThan(
      Number(preview!.getAttribute("fill-opacity")),
    );
  });
});

describe("MachineryRoomMarker", () => {
  it("draws a bar across the hull at the station, labelled M", () => {
    const { container } = draw(
      <MachineryRoomMarker frame={frame} stationPermille={400} variant="linked" />,
    );
    const group = container.querySelector("[data-testid='room-linked']")!;
    expect(group.getAttribute("data-station")).toBe("400");
    const line = group.querySelector("line")!;
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(frame.x(400), 6);
    expect(Number(line.getAttribute("y1"))).toBeCloseTo(PLAN_MID - frame.maxHalf - 2, 6);
    expect(Number(line.getAttribute("y2"))).toBeCloseTo(PLAN_MID + frame.maxHalf + 2, 6);
    expect(line.getAttribute("stroke-dasharray")).toBe("1 3");
    expect(group.querySelector("text")!.textContent).toBe("M");
  });

  it("a selected room is a solid, heavier bar", () => {
    const { container } = draw(
      <MachineryRoomMarker frame={frame} stationPermille={400} variant="selected" />,
    );
    const group = container.querySelector("[data-testid='room-selected']")!;
    const line = group.querySelector("line")!;
    expect(line.getAttribute("stroke-dasharray")).toBeNull();
    expect(Number(line.getAttribute("stroke-width"))).toBe(2.2);
    expect(Number(line.getAttribute("stroke-width"))).toBeGreaterThan(STROKE.structure);
  });
});
