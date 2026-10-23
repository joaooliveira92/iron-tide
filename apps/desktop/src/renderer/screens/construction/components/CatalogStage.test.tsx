import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import { axeViolations } from "../../../lib/axe.js";
import { CatalogStage } from "./CatalogStage.js";

afterEach(cleanup);

const design = (id: string, over: Record<string, unknown> = {}) =>
  createCompiledDesignVersion(id, {
    className: id,
    shipType: "battleship",
    nationId: "uk",
    year: 1906,
    available: true,
    mass: 18_000,
    speed: 21,
    machineryType: "steam_turbine",
    requiredTechnologyIds: [],
    projectedCost: 180,
    projectedCapacityUnits: 18,
    costBasis: "displacement_formula",
    ...over,
  });

const economy = {
  treasury: 1000,
  monthlyAppropriation: 100,
  shipyardCapacity: 50,
  dockMaxBuildDisplacementKg: 20_000_000,
  maxConcurrentConstructionMassKg: 39_000_000,
  committedNewConstructionMassKg: 0,
  exemptNewConstructionMassKg: 0,
  dockExpansionDurationMonths: 12,
  dockExpansionNextStepKg: null,
  dockPossessions: [],
};
const workspace = { commands: [], treasuryReserved: 0, capacityReserved: 0 };

const stage = (
  designs: ReturnType<typeof design>[],
  selected: string | null = null,
  pick = () => {},
) => (
  <CatalogStage
    designs={designs}
    economy={economy}
    workspace={workspace}
    selectedDesignId={selected}
    onSelectDesign={pick}
  />
);

describe("CatalogStage", () => {
  it("marks a design its era has not reached as not yet available, and does not select it", () => {
    render(stage([design("Dreadnought", { available: false })]));
    expect(screen.getByText("Not yet available")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Dreadnought/ })).toHaveProperty("disabled", true);
  });

  it("does not mark an era-available design", () => {
    render(stage([design("Dreadnought")]));
    expect(screen.queryByText("Not yet available")).toBeNull();
  });

  it("selects a design from its tile", () => {
    const picked: string[] = [];
    render(
      <CatalogStage
        designs={[design("Dreadnought")]}
        economy={economy}
        workspace={workspace}
        selectedDesignId="Dreadnought"
        onSelectDesign={(id) => picked.push(id)}
      />,
    );
    const tile = screen.getByRole("radio", { name: /Dreadnought/ });
    expect(tile.getAttribute("aria-checked")).toBe("true");
    tile.click();
    expect(picked).toEqual(["Dreadnought"]);
  });

  it("says when a hull is too large for the dock or the treasury cannot pay for it", () => {
    render(stage([design("Leviathan", { mass: 30_000, projectedCost: 5000 })]));
    expect(screen.getByText("too large")).toBeTruthy();
    expect(screen.getByText("cannot afford")).toBeTruthy();
  });

  it("filters by ship type", () => {
    render(stage([design("Dreadnought"), design("Havock", { shipType: "destroyer" })]));
    const group = screen.getByRole("group", { name: "Catalog filters" });
    fireEvent.click(within(group).getByRole("button", { name: "destroyer" }));
    expect(screen.queryByRole("radio", { name: /Dreadnought/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Havock/ })).toBeTruthy();
  });

  it("says so when there are no approved designs", () => {
    render(stage([]));
    expect(screen.getByText("No approved designs")).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(stage([design("Dreadnought"), design("Havock")], "Havock"));
    expect(await axeViolations(container)).toEqual([]);
  });
});
