import {
  createCompiledDesignVersion,
  type ConstructionProjectQueueEntry,
} from "@bluewave/campaign-engine";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { memo, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ConstructionScreenProjection } from "../../../shared/construction-contract.js";
import { ConstructionScreen } from "./ConstructionScreen.js";
import { steeringPreview } from "./steering-test-fixtures.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), revise: vi.fn() }));
vi.mock("../../shell/CampaignShellContext.js", async (original) => ({
  ...(await original<typeof import("../../shell/CampaignShellContext.js")>()),
  useReviseProject: () => mocks.revise,
}));
const stageRenders = vi.hoisted(() => ({ slipways: vi.fn() }));
const tileRenders = vi.hoisted(() => ({ byDesign: new Map<string, number>() }));
vi.mock("./components/DesignTile.js", async (original) => {
  const real = await original<typeof import("./components/DesignTile.js")>();
  const Counted = memo(function Counted(props: ComponentProps<typeof real.DesignTile>) {
    const id = props.design.designId;
    tileRenders.byDesign.set(id, (tileRenders.byDesign.get(id) ?? 0) + 1);
    return <real.DesignTile {...props} />;
  });
  return { ...real, DesignTile: Counted };
});
vi.mock("./components/SlipwaysStage.js", async (original) => {
  const real = await original<typeof import("./components/SlipwaysStage.js")>();
  const Counted = memo(function Counted(props: ComponentProps<typeof real.SlipwaysStage>) {
    stageRenders.slipways();
    return <real.SlipwaysStage {...props} />;
  });
  return { ...real, SlipwaysStage: Counted };
});
vi.mock("../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
  mocks.revise.mockReset();
  stageRenders.slipways.mockClear();
  tileRenders.byDesign.clear();
});

const project = (
  over: Partial<ConstructionProjectQueueEntry> = {},
): ConstructionProjectQueueEntry => ({
  projectId: "project-1",
  designVersionId: "design-1",
  className: "Havock class",
  shipType: "destroyer",
  status: "ACTIVE",
  totalWork: 100,
  completedWork: 10,
  paidWork: 10,
  startedAt: "1880-01",
  commandId: null,
  revisable: true,
  holdUntilMonth: null,
  isForeign: false,
  ...over,
});

const projectionWith = (
  projects: readonly ConstructionProjectQueueEntry[],
): ConstructionScreenProjection => ({
  revision: 3,
  month: { month: 1, year: 1880 },
  economy: {
    treasury: 1_000,
    monthlyAppropriation: 0,
    shipyardCapacity: 2,
    dockMaxBuildDisplacementKg: 13_000_000,
    maxConcurrentConstructionMassKg: 39_000_000,
    committedNewConstructionMassKg: 0,
    exemptNewConstructionMassKg: 0,
    dockExpansionDurationMonths: 12,
    dockExpansionNextStepKg: 1_000_000,
    dockExpansionReadyMonth: "1880-12",
    dockPossessions: [],
  },
  designs: [],
  projects,
  steering: {},
  workspace: { commands: [], treasuryReserved: 0, capacityReserved: 0 },
});

const serve = (projection: ConstructionScreenProjection) =>
  mocks.execute.mockImplementation(async (command: string) => {
    if (command === "inspectConstructionScreen")
      return { outcome: "success", value: projection, diagnostics: [] };
    return { outcome: "failure", reason: "UNEXPECTED", diagnostics: [command] };
  });

describe("ConstructionScreen stage memoization", () => {
  it("does not re-render the slipways stage when only the inspector layout changes", async () => {
    serve(projectionWith([project()]));
    render(<ConstructionScreen sessionId="ses_1" />);
    await screen.findByRole("button", { name: /^Havock class, active/ });
    const rendersBefore = stageRenders.slipways.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Hide inspector" }));
    await screen.findByRole("button", { name: "Show inspector" });

    expect(stageRenders.slipways.mock.calls.length).toBe(rendersBefore);
  });

  it("re-renders only the design tiles whose selection changed", async () => {
    const designs = ["d1", "d2", "d3"].map((id) =>
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
      }),
    );
    serve({ ...projectionWith([]), designs });
    render(<ConstructionScreen sessionId="ses_1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Design catalog/ }));
    const tiles = await screen.findAllByRole("radio");
    const second = tiles[1];
    if (second === undefined) throw new Error("expected three design tiles");
    const thirdBefore = tileRenders.byDesign.get("d3") ?? 0;

    fireEvent.click(second);

    await waitFor(() => expect(second.getAttribute("aria-checked")).toBe("true"));
    expect(tileRenders.byDesign.get("d3") ?? 0).toBe(thirdBefore);
  });
});

describe("ConstructionScreen revise project", () => {
  it("sends the selected revisable project to the Ship design screen", async () => {
    serve(projectionWith([project()]));
    render(<ConstructionScreen sessionId="ses_1" />);

    fireEvent.click(await screen.findByRole("button", { name: /^Havock class, active/ }));
    expect(mocks.revise).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Havock class revise" }));

    await waitFor(() => expect(mocks.revise).toHaveBeenCalledWith("project-1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers no revise control for a project built from an authored design", async () => {
    serve({
      ...projectionWith([project({ revisable: false })]),
      steering: { "project-1": steeringPreview() },
    });
    render(<ConstructionScreen sessionId="ses_1" />);

    fireEvent.click(await screen.findByRole("button", { name: /^Havock class, active/ }));
    await screen.findByRole("button", { name: "Havock class halt" });
    expect(screen.queryByRole("button", { name: "Havock class revise" })).toBeNull();
  });
});
