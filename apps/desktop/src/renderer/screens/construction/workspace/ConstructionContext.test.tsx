import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ConstructionScreenProjection } from "../../../../shared/construction-contract.js";
import {
  ConstructionProvider,
  useConstructionActions,
  useConstructionState,
  type ConstructionActions,
} from "./ConstructionContext.js";

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  return { execute, bridge: { campaign: { execute } } };
});
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => mocks.bridge,
}));

const probe = vi.hoisted(() => ({
  loaded: false,
  actions: null as ConstructionActions | null,
  actionReads: 0,
}));

function StateProbe() {
  probe.loaded = useConstructionState().screen !== null;
  return null;
}

function ActionsProbe() {
  probe.actions = useConstructionActions();
  probe.actionReads += 1;
  return null;
}

const projection: ConstructionScreenProjection = {
  revision: 1,
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
  projects: [],
  studies: [],
  steering: {},
  workspace: { commands: [], treasuryReserved: 0, capacityReserved: 0 },
};

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
  probe.loaded = false;
  probe.actions = null;
  probe.actionReads = 0;
});

async function mountLoaded() {
  mocks.execute.mockImplementation(async (command: string) =>
    command === "inspectConstructionScreen"
      ? { outcome: "success", value: projection, diagnostics: [] }
      : { outcome: "failure", reason: "UNEXPECTED", diagnostics: [command] },
  );
  render(
    <ConstructionProvider sessionId="ses_1">
      <StateProbe />
      <ActionsProbe />
    </ConstructionProvider>,
  );
  await waitFor(() => expect(probe.loaded).toBe(true));
}

describe("ConstructionProvider action stability", () => {
  it("does not re-render action consumers when only the inspector layout changes", async () => {
    await mountLoaded();
    const actionsBefore = probe.actions;
    const readsBefore = probe.actionReads;

    act(() => probe.actions?.toggleInspector());

    expect(probe.actions).toBe(actionsBefore);
    expect(probe.actionReads).toBe(readsBefore);
  });
});
