/* @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { DEFAULT_APP_PREFERENCES } from "../../../shared/preferences-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { PreferencesProvider } from "../../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../../lib/preferences-test-bridge.js";
import { DensityProvider } from "../DensityContext.js";
import type { StatusStripModel, StripRow } from "../status-strip-state.js";
import { useStatusStripWorkspace } from "./useStatusStripWorkspace.js";

const ROW: StripRow = {
  id: "treasury",
  label: "Treasury",
  value: "1,000 NC",
  deferred: false,
  note: "",
  tone: "normal",
};

const MODEL: StatusStripModel = {
  nationName: "Britain",
  prestige: {
    current: 20,
    threshold: 16,
    fraction: 0.5,
    thresholdFraction: 0.4,
    atRisk: false,
  },
  outlook: {
    appropriation: "100 NC",
    steps: [],
    balance: { value: "41 NC", status: "Healthy", tone: "normal" },
    afterConstruction: { value: "39 NC", tone: "normal" },
    treasury: "1,000 NC",
    monthEndTreasury: "1,041 NC",
    runway: null,
    runwayMonths: null,
    monthEndTreasuryValue: 1041,
    shortfall: null,
    research: { requested: "5 NC", cap: "5 NC", note: "" },
  },
  stations: {
    total: 0,
    foreign: 0,
    foreignTons: null,
    totalTons: null,
    foreignTonsFraction: null,
    foreignGroups: [],
    unknown: false,
  },
  ports: [],
  allocation: {
    appropriation: "100 NC",
    segments: [],
    committed: { value: "59 NC", percent: "59%" },
    overCommitted: false,
    limit: 1,
  },
  nation: [
    { ...ROW, id: "prestige", label: "Prestige", value: "20" },
    { ...ROW, id: "unrest", deferred: true },
  ],
  budget: [ROW, { ...ROW, id: "balance", label: "Monthly balance (projected)" }],
  deferredRows: [{ ...ROW, id: "unrest", deferred: true }],
  summary: {
    balance: { value: "41 NC", status: "Healthy", tone: "normal" },
    treasury: "1,000 NC",
    alerts: "1 alert",
  },
};

function wrapperFor(density: "comfortable" | "compact") {
  const stub = createPreferencesBridgeStub({
    ...DEFAULT_APP_PREFERENCES,
    interfaceDensity: density,
  });
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return (
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>{children}</DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>
    );
  };
}

function workspace(startCollapsed = false) {
  return renderHook(() => useStatusStripWorkspace({ model: MODEL, trend: null, startCollapsed }), {
    wrapper: wrapperFor("comfortable"),
  });
}

describe("useStatusStripWorkspace", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("starts expanded from density and the screen's initial request", async () => {
    const open = workspace();
    await waitFor(() => expect(open.result.current.state.expanded).toBe(true));

    const collapsed = workspace(true);
    await waitFor(() => expect(collapsed.result.current.state.expanded).toBe(false));
  });

  it("starts collapsed in compact density", async () => {
    const { result } = renderHook(
      () => useStatusStripWorkspace({ model: MODEL, trend: null, startCollapsed: false }),
      { wrapper: wrapperFor("compact") },
    );
    await waitFor(() => expect(result.current.state.expanded).toBe(false));
  });

  it("sets and toggles the expansion through the actions", async () => {
    const { result } = workspace(true);
    await waitFor(() => expect(result.current.state.expanded).toBe(false));

    act(() => result.current.actions.setExpanded(true));
    expect(result.current.state.expanded).toBe(true);

    act(() => result.current.actions.toggle());
    expect(result.current.state.expanded).toBe(false);
  });

  it("keeps an explicit choice after the initial request", async () => {
    const { result, rerender } = workspace(true);
    await waitFor(() => expect(result.current.state.expanded).toBe(false));
    act(() => result.current.actions.setExpanded(true));
    rerender();
    expect(result.current.state.expanded).toBe(true);
  });

  it("derives the rows each part reads from the model", async () => {
    const { result } = workspace();
    await waitFor(() => expect(result.current.state.model).toBe(MODEL));
    expect(result.current.meta.nationRows.map((row) => row.id)).toEqual(["prestige"]);
    expect(result.current.meta.budgetRows.map((row) => row.id)).toEqual(["treasury", "balance"]);
    expect(result.current.meta.summary.alerts).toBe("1 alert");
  });
});
