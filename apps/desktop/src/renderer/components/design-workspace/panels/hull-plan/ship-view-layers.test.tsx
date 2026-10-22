import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ReactElement } from "react";
import { machineryRooms } from "../../selection/facts.js";
import {
  ArmourZoneLayer,
  CompartmentLayer,
  MachineryLayoutLayer,
  MassMarkersLayer,
} from "./ship-view-layers.js";
import { PLAN_MID } from "./geometry.js";
import { frame, hullForm, reference, view } from "./test-fixtures.js";

afterEach(cleanup);

const draw = (node: ReactElement) => render(<svg>{node}</svg>);

describe("ArmourZoneLayer", () => {
  it("draws the citadel and the belt from their real lengths, amidships by convention", () => {
    const draft = {
      ...reference.draft,
      armour: {
        ...reference.draft.armour,
        citadelLengthMm: 60_000,
        regions: [
          {
            region: "BELT_MAIN" as const,
            thicknessUm: 200_000,
            lengthMm: 50_000,
            heightMm: 3_000,
            materialId: "steel",
            cosObliquityBp: 10_000,
          },
        ],
      },
    };
    draw(<ArmourZoneLayer frame={frame} draft={draft} />);
    expect(screen.getByTestId("armour-citadel")).toBeTruthy();
    const belt = screen.getByTestId("armour-belt");
    expect(belt.tagName.toLowerCase()).toBe("path");
    expect(belt.getAttribute("d")).toMatch(/^M/);
    expect(belt.querySelector("title")?.textContent).toMatch(/amidships is a convention/);
  });

  it("hatches the citadel only when the design carries deck armour", () => {
    const region = (r: "BELT_MAIN" | "DECK_MAIN") => ({
      region: r,
      thicknessUm: 100_000,
      lengthMm: 50_000,
      heightMm: 3_000,
      materialId: "steel",
      cosObliquityBp: 10_000,
    });
    const armour = (regions: ReturnType<typeof region>[]) => ({
      ...reference.draft,
      armour: { ...reference.draft.armour, citadelLengthMm: 60_000, regions },
    });
    draw(<ArmourZoneLayer frame={frame} draft={armour([region("BELT_MAIN")])} />);
    expect(screen.queryByTestId("armour-deck")).toBeNull();
    cleanup();
    draw(
      <ArmourZoneLayer frame={frame} draft={armour([region("BELT_MAIN"), region("DECK_MAIN")])} />,
    );
    expect(screen.getByTestId("armour-deck")).toBeTruthy();
  });

  it("draws deck armour on its own length even with no belt or citadel (a protected cruiser)", () => {
    const draft = {
      ...reference.draft,
      armour: {
        ...reference.draft.armour,
        citadelLengthMm: 0,
        regions: [
          {
            region: "DECK_MAIN" as const,
            thicknessUm: 50_000,
            lengthMm: 40_000,
            heightMm: 0,
            materialId: "steel",
            cosObliquityBp: 10_000,
          },
        ],
      },
    };
    draw(<ArmourZoneLayer frame={frame} draft={draft} />);
    expect(screen.getByTestId("armour-deck")).toBeTruthy();
    expect(screen.queryByTestId("armour-belt")).toBeNull();
  });

  it("highlights a deck region over the inner hull and a belt region as side strips", () => {
    const withRegion = (r: "BELT_UPPER" | "DECK_MAIN") => ({
      ...reference.draft,
      armour: {
        ...reference.draft.armour,
        citadelLengthMm: 0,
        regions: [
          {
            region: r,
            thicknessUm: 100_000,
            lengthMm: 40_000,
            heightMm: 2_000,
            materialId: "steel",
            cosObliquityBp: 10_000,
          },
        ],
      },
    });
    draw(<ArmourZoneLayer frame={frame} draft={withRegion("BELT_UPPER")} highlight="BELT_UPPER" />);
    const strip = screen.getByTestId("armour-highlight").getAttribute("d")!;
    cleanup();
    draw(<ArmourZoneLayer frame={frame} draft={withRegion("DECK_MAIN")} highlight="DECK_MAIN" />);
    const deck = screen.getByTestId("armour-highlight").getAttribute("d")!;
    expect(strip.match(/M/g)).toHaveLength(2);
    expect(deck.match(/M/g)).toHaveLength(1);
  });

  it("draws nothing when the design carries no armour", () => {
    const draft = {
      ...reference.draft,
      armour: { ...reference.draft.armour, citadelLengthMm: 0, regions: [] },
    };
    draw(<ArmourZoneLayer frame={frame} draft={draft} />);
    expect(screen.queryByTestId("armour-zones")).toBeNull();
  });
});

describe("CompartmentLayer", () => {
  it("bands every hull section, naming it for the pointer", () => {
    draw(<CompartmentLayer frame={frame} zones={hullForm.zones} />);
    expect(screen.getByTestId("compartments").querySelectorAll("[data-compartment]")).toHaveLength(
      hullForm.zones.length,
    );
  });

  it("clips each section to the hull instead of boxing it past the bow and stern", () => {
    const { container } = draw(<CompartmentLayer frame={frame} zones={hullForm.zones} />);
    const bow = container.querySelector("[data-compartment='FORECASTLE']")!;
    expect(bow.tagName.toLowerCase()).toBe("path");
    const ys = bow
      .getAttribute("d")!
      .replace(/[MZ]/g, " ")
      .trim()
      .split(/\s+/)
      .map((p) => Number(p.split(",")[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(frame.maxHalf * 2);
    expect(Math.min(...ys)).toBeGreaterThan(PLAN_MID - frame.maxHalf);
  });

  it("tints magazines and machinery apart from the other sections", () => {
    const { container } = draw(<CompartmentLayer frame={frame} zones={hullForm.zones} />);
    const kind = (id: string) =>
      container.querySelector(`[data-compartment='${id}']`)!.getAttribute("data-kind");
    expect(kind("FWD_MAGAZINE")).toBe("magazine");
    expect(kind("CENTRAL_MACHINERY")).toBe("machinery");
    expect(kind("QUARTERDECK")).toBe("other");
  });

  it("numbers the eight sections bow to stern, matching the strip beneath", () => {
    const { container } = draw(<CompartmentLayer frame={frame} zones={hullForm.zones} />);
    const labels = Array.from(container.querySelectorAll("[data-compartment-number]")).map(
      (t) => t.textContent,
    );
    expect(labels).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });
});

describe("MachineryLayoutLayer", () => {
  it("marks each machinery room at its station", () => {
    draw(<MachineryLayoutLayer frame={frame} draft={reference.draft} />);
    expect(
      screen.getByTestId("machinery-layout").querySelectorAll("[data-machinery-room]"),
    ).toHaveLength(machineryRooms(reference.draft).length);
  });
});

describe("MassMarkersLayer", () => {
  it("places the centre of gravity at the compiled longitudinal position", () => {
    const lcg = view.compiled.stability?.lcgPermille ?? 500;
    draw(<MassMarkersLayer frame={frame} lcgPermille={lcg} />);
    expect(screen.getByTestId("mass-cg").querySelector("title")?.textContent).toContain(
      `${Math.round(lcg)}‰`,
    );
  });
});
