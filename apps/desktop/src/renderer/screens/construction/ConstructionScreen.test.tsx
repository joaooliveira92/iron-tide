import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ConstructionScreenProjection } from "../../../shared/construction-contract.js";
import { ConstructionScreen } from "./ConstructionScreen.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), revise: vi.fn() }));
vi.mock("../../shell/CampaignShellContext.js", async (original) => ({
  ...(await original<typeof import("../../shell/CampaignShellContext.js")>()),
  useReviseProject: () => mocks.revise,
}));
vi.mock("../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
  mocks.revise.mockReset();
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
