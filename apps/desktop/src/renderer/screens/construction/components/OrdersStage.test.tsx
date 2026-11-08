import { createCompiledDesignVersion, type ConstructionCommand } from "@bluewave/campaign-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OrdersStage } from "./OrdersStage.js";

const debugFlag = vi.hoisted(() => ({ on: false }));
vi.mock("../../../shell/debug-flag.js", () => ({
  get DEBUG_MODE() {
    return debugFlag.on;
  },
}));

afterEach(() => {
  cleanup();
  debugFlag.on = false;
});

const design = createCompiledDesignVersion("design_majestic", {
  className: "Majestic",
  shipType: "battleship",
  nationId: "nation_uk",
  year: 1894,
  available: true,
  mass: 16000,
  speed: 16,
  machineryType: "coal_vte",
  requiredTechnologyIds: [],
  projectedCost: 160,
  projectedCapacityUnits: 16,
  costBasis: "displacement_formula",
});

const command: ConstructionCommand = {
  commandId: "cmd_debug_0007",
  designId: "design_majestic",
  design,
  nationId: "nation_uk",
  status: "submitted",
  projectedCost: 160,
  projectedCapacityUnits: 16,
  submittedAtRevision: 3,
};

const economy = {
  treasury: 1000,
  monthlyAppropriation: 100,
  shipyardCapacity: 50,
  dockMaxBuildDisplacementKg: 13_000_000,
  maxConcurrentConstructionMassKg: 39_000_000,
  committedNewConstructionMassKg: 2_000_000,
  exemptNewConstructionMassKg: 0,
  dockExpansionDurationMonths: 12,
  dockExpansionNextStepKg: null,
  dockPossessions: [],
};

function renderOrders() {
  render(
    <OrdersStage
      commands={[command]}
      economy={economy}
      busy={false}
      selectedDesignId={null}
      selectedCommandId={null}
      onSelectCommand={() => {}}
      onReplace={() => {}}
      onCancel={() => {}}
      onBrowseCatalog={() => {}}
    />,
  );
}

describe("OrdersStage developer columns", () => {
  it("hides the command id and revision columns outside debug mode", () => {
    renderOrders();
    expect(screen.queryByRole("columnheader", { name: "Command" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Rev" })).toBeNull();
    expect(screen.queryByText("cmd_debug_0007")).toBeNull();
  });

  it("shows the command id and revision columns in debug mode", () => {
    debugFlag.on = true;
    renderOrders();
    expect(screen.getByRole("columnheader", { name: "Command" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Rev" })).toBeTruthy();
  });
});
