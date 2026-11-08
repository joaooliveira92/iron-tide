import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ConstructionScreenProjection } from "../../../shared/construction-contract.js";
import { loadDrawingBoardContent } from "../../components/design-workspace/content.js";
import { ConstructionScreen } from "./ConstructionScreen.js";

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  return { execute, bridge: { campaign: { execute } } };
});
vi.mock("../../shell/CampaignShellContext.js", async (original) => ({
  ...(await original<typeof import("../../shell/CampaignShellContext.js")>()),
  useReviseProject: () => vi.fn(),
  useCampaignRevision: () => 3,
}));
vi.mock("../../lib/bridge-context.js", () => ({
  useBridge: () => mocks.bridge,
}));

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

const ship = {
  shipId: "ship-1",
  name: "HMS Havock",
  className: "Havock class",
  designVersionId: "des_old",
};

const rebuildProject = (): ConstructionProjectQueueEntry & {
  readonly rebuild: {
    readonly shipId: string;
    readonly shipName: string;
    readonly designVersionId: string;
  };
} => ({
  projectId: "project-rebuild",
  designVersionId: "des_new",
  className: "Havock class",
  shipType: "destroyer",
  status: "ACTIVE",
  totalWork: 100,
  completedWork: 10,
  paidWork: 10,
  startedAt: "1880-01",
  commandId: null,
  revisable: false,
  holdUntilMonth: null,
  isForeign: false,
  rebuild: { shipId: "ship-1", shipName: "HMS Havock", designVersionId: "des_new" },
});

const projection = (
  projects: ConstructionScreenProjection["projects"],
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

const ok = (value: unknown) => ({ outcome: "success", value, diagnostics: [] });

const serve = (screenProjection: ConstructionScreenProjection) => {
  const draft = loadDrawingBoardContent().references[0]!.draft;
  mocks.execute.mockImplementation(async (command: string) => {
    switch (command) {
      case "inspectConstructionScreen":
        return ok(screenProjection);
      case "listRebuildableShips":
        return ok([ship]);
      case "loadShipDraft":
        return ok({ draft });
      case "checkRebuild":
        return ok({
          legal: true,
          findings: [],
          designProblems: [],
          changesNothing: false,
          measures: null,
          bulgeProtectionGainBp: null,
        });
      case "startRebuildCommand":
        return ok({
          commandId: "cmd",
          projectId: "project-rebuild",
          newDesignVersionId: "des_new",
          appliedOnNextTurn: true,
        });
      default:
        return { outcome: "failure", reason: "UNEXPECTED", diagnostics: [command] };
    }
  });
};

const startCalls = () =>
  mocks.execute.mock.calls.filter(([command]) => command === "startRebuildCommand");

describe("Build tab rebuild entry", () => {
  it("lists rebuildable ships, checks a rebuild and starts it with one command", async () => {
    serve(projection([]));
    render(<ConstructionScreen sessionId="ses_1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Rebuild a ship" }));
    const dialog = await screen.findByRole("dialog", { name: "Rebuild a ship" });
    expect(await within(dialog).findByRole("combobox", { name: "Ship to rebuild" })).toBeTruthy();
    expect(within(dialog).getByText("HMS Havock (Havock class)")).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Load this ship's design to rebuild it" }),
    );
    await within(dialog).findByText("Rebuild allowed");
    expect(mocks.execute).toHaveBeenCalledWith(
      "checkRebuild",
      expect.objectContaining({ sessionId: "ses_1", shipId: "ship-1" }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Start the rebuild" }));
    await waitFor(() => expect(startCalls()).toHaveLength(1));
    expect(startCalls()[0]?.[1]).toEqual(expect.objectContaining({ shipId: "ship-1" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await within(dialog).findByText(/Rebuild of HMS Havock queued/);
  });

  it("shows a started rebuild on the Slipways stage with the Rebuild badge and target", async () => {
    serve(projection([rebuildProject()]));
    render(<ConstructionScreen sessionId="ses_1" />);

    const lane = await screen.findByRole("button", { name: /^Havock class, active/ });
    const item = lane.closest("li")!;
    expect(within(item).getByText("Rebuild")).toBeTruthy();
    expect(within(item).getByText(/HMS Havock/)).toBeTruthy();
  });
});
