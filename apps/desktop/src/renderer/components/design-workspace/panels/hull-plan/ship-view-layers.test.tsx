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
    expect(belt.getAttribute("width")).not.toBe("0");
    expect(belt.querySelector("title")?.textContent).toMatch(/amidships is a convention/);
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
