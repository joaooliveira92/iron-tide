import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { memo, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ConstructionScreenProjection } from "../../../shared/construction-contract.js";
import { ConstructionScreen } from "./ConstructionScreen.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), revise: vi.fn() }));
vi.mock("../../shell/CampaignShellContext.js", async (original) => ({
  ...(await original<typeof import("../../shell/CampaignShellContext.js")>()),
  useReviseProject: () => mocks.revise,
}));
const stageRenders = vi.hoisted(() => ({ slipways: vi.fn() }));
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
    dockPossessions: [],
  },
  designs: [],
  projects,
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
});

describe("ConstructionScreen revise project", () => {
  it("sends the selected revisable project to the Ship design screen", async () => {
    serve(projectionWith([project()]));
    render(<ConstructionScreen sessionId="ses_1" />);

    (await screen.findByRole("button", { name: /^Havock class, active/ })).click();
    expect(mocks.revise).not.toHaveBeenCalled();
    (await screen.findByRole("button", { name: "Havock class revise" })).click();

    await waitFor(() => expect(mocks.revise).toHaveBeenCalledWith("project-1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers no revise control for a project built from an authored design", async () => {
    serve(projectionWith([project({ revisable: false })]));
    render(<ConstructionScreen sessionId="ses_1" />);

    (await screen.findByRole("button", { name: /^Havock class, active/ })).click();
    await screen.findByRole("button", { name: "Havock class halt" });
    expect(screen.queryByRole("button", { name: "Havock class revise" })).toBeNull();
  });
});
