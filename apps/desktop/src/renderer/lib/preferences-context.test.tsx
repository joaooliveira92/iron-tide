import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "./bridge-context.js";
import {
  type ActiveCampaignCurrencyContext,
  type NationalCurrencyConfiguration,
  type NationalCurrencySource,
} from "./presentation-format/index.js";
import { PreferencesProvider, useCurrencyDisplayMode } from "./preferences-context.js";
import { createPreferencesBridgeStub } from "./preferences-test-bridge.js";

function makeWrapper(bridge: BluewaveDesktopBridge) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BridgeProvider bridge={bridge}>
        <PreferencesProvider>{children}</PreferencesProvider>
      </BridgeProvider>
    );
  };
}

const POUNDS: NationalCurrencyConfiguration = {
  id: "gbr-gbp",
  nationId: "uk",
  displayName: "Pounds sterling",
  symbol: "£",
  symbolPosition: "prefix",
  spacing: false,
  decimals: 0,
  grouping: true,
  negatives: "minus",
  scale: null,
  period: { fromYear: 1880, toYear: 1939 },
  source: "fixture",
  interpretation: "relabel",
};

interface CurrencyArgs {
  readonly context: ActiveCampaignCurrencyContext;
  readonly source?: NationalCurrencySource;
}

function renderCurrency(bridge: BluewaveDesktopBridge, initial: CurrencyArgs) {
  return renderHook(
    ({ context, source }: CurrencyArgs) => useCurrencyDisplayMode(context, source),
    {
      initialProps: initial,
      wrapper: makeWrapper(bridge),
    },
  );
}

describe("useCurrencyDisplayMode", () => {
  it("exposes the requested mode and a Naval Credits effective mode by default", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderCurrency(stub.bridge, { context: {} });
    await act(async () => {});
    expect(result.current.requested).toBe("navalCredits");
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBeUndefined();
  });

  it("persists a request change and keeps it while the effective mode falls back", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderCurrency(stub.bridge, { context: {} });
    await act(async () => {});

    act(() => result.current.setRequested("nationalHistorical"));
    await act(async () => {});

    expect(result.current.requested).toBe("nationalHistorical");
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBe("noActiveNation");
    expect(stub.writes.at(-1)?.app.currencyDisplayMode).toBe("nationalHistorical");
    expect(stub.current().app.currencyDisplayMode).toBe("nationalHistorical");
  });

  it("reasons noActiveNation with no active campaign and nationalCurrencyNotConfigured for an unconfigured nation", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result, rerender } = renderCurrency(stub.bridge, { context: {} });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBe("noActiveNation");

    rerender({ context: { nationId: "uk", year: 1900 } });
    await waitFor(() =>
      expect(result.current.fallbackReason).toBe("nationalCurrencyNotConfigured"),
    );
    expect(result.current.effective).toBe("navalCredits");
  });

  it("reasons nationalCurrencyInvalid for a nation whose configuration failed validation", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result } = renderCurrency(stub.bridge, {
      context: { nationId: "france", year: 1900 },
      source: { configurations: [], invalidNationIds: ["france"] },
    });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.fallbackReason).toBe("nationalCurrencyInvalid");
    expect(result.current.effective).toBe("navalCredits");
  });

  it("reasons nationalCurrencyOutsideSupportedPeriod when the campaign year is out of range", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result } = renderCurrency(stub.bridge, {
      context: { nationId: "uk", year: 1945 },
      source: { configurations: [POUNDS] },
    });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.fallbackReason).toBe("nationalCurrencyOutsideSupportedPeriod");
    expect(result.current.effective).toBe("navalCredits");
  });

  it("honours National Historical when a validated configuration applies", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result } = renderCurrency(stub.bridge, {
      context: { nationId: "uk", year: 1900 },
      source: { configurations: [POUNDS] },
    });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.effective).toBe("nationalHistorical");
    expect(result.current.fallbackReason).toBeUndefined();
  });

  it("preserves the stored request across an unsupported→supported transition and restores it", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result, rerender } = renderCurrency(stub.bridge, { context: {} });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBe("noActiveNation");

    rerender({ context: { nationId: "uk", year: 1900 }, source: { configurations: [POUNDS] } });
    await waitFor(() => expect(result.current.effective).toBe("nationalHistorical"));
    expect(result.current.requested).toBe("nationalHistorical");
    expect(result.current.fallbackReason).toBeUndefined();
    expect(stub.writes).toHaveLength(0);
    expect(stub.current().app.currencyDisplayMode).toBe("nationalHistorical");
  });

  it("honours Budget Points unconditionally even with no active campaign", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "budgetPoints",
    });
    const { result } = renderCurrency(stub.bridge, { context: {} });
    await waitFor(() => expect(result.current.requested).toBe("budgetPoints"));
    expect(result.current.effective).toBe("budgetPoints");
    expect(result.current.fallbackReason).toBeUndefined();
  });

  it("never rewrites the stored request when the effective mode falls back", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result } = renderCurrency(stub.bridge, { context: {} });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBe("noActiveNation");
    expect(stub.writes).toHaveLength(0);
    expect(stub.current().app.currencyDisplayMode).toBe("nationalHistorical");
  });
});
