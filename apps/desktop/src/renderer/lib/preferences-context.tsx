import { createContext, use, useCallback, useMemo, useRef, type ReactNode } from "react";

import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  DEFAULT_APP_PREFERENCES,
  resolveEffectiveCurrencyDisplayMode,
  type AppPreferences,
  type CurrencyDisplayMode,
  type CurrencyFallbackReason,
  type PreferencesSnapshot,
  type WriteAppPreferencesRequest,
} from "../../shared/preferences-contract.js";
import {
  NO_NATIONAL_CURRENCY_CONFIGURATIONS,
  computeNationalCurrencyAvailability,
} from "./presentation-format/currency-availability.js";
import {
  type ActiveCampaignCurrencyContext,
  type NationalCurrencySource,
} from "./presentation-format/index.js";
import { useBridge } from "./bridge-context.js";
import { useStoreLifecycle } from "./use-store-lifecycle.js";

export type PreferencesStatus = "loading" | "ready" | "error";

interface PreferencesCapability {
  read(): Promise<BridgeResult<PreferencesSnapshot>>;
  write(request: WriteAppPreferencesRequest): Promise<BridgeResult<PreferencesSnapshot>>;
}

export interface PreferencesContextValue {
  readonly preferences: AppPreferences;
  readonly status: PreferencesStatus;
  readonly setApp: (patch: Partial<AppPreferences>) => void;
}

interface PreferencesState {
  readonly preferences: AppPreferences;
  readonly status: PreferencesStatus;
}

function withStatus(state: PreferencesState, status: PreferencesStatus): PreferencesState {
  return state.status === status ? state : { ...state, status };
}

const DEFAULT_CONTEXT_VALUE: PreferencesContextValue = {
  preferences: DEFAULT_APP_PREFERENCES,
  status: "ready",
  setApp: () => {},
};

const PreferencesContext = createContext<PreferencesContextValue>(DEFAULT_CONTEXT_VALUE);

const DEFAULT_CURRENCY_CONTEXT: ActiveCampaignCurrencyContext = {};

export function PreferencesProvider({
  children,
  initialSnapshot,
}: {
  readonly children: ReactNode;
  readonly initialSnapshot?: PreferencesSnapshot | undefined;
}) {
  const bridge = useBridge();
  const capability: PreferencesCapability | undefined = bridge?.preferences;
  const writeSeqRef = useRef(0);

  const [{ preferences, status }, store] = useStoreLifecycle<PreferencesState>(
    () => ({
      preferences: initialSnapshot?.app ?? DEFAULT_APP_PREFERENCES,
      status: capability === undefined || initialSnapshot !== undefined ? "ready" : "loading",
    }),
    (target) => {
      if (capability === undefined) {
        target.set((state) => withStatus(state, "ready"));
        return;
      }
      if (initialSnapshot !== undefined) {
        target.set({ preferences: initialSnapshot.app, status: "ready" });
        return;
      }
      let active = true;
      target.set((state) => withStatus(state, "loading"));
      const seqAtStart = writeSeqRef.current;
      void capability
        .read()
        .then((result) => {
          if (!active) return;
          if (writeSeqRef.current !== seqAtStart) return;
          if (result.outcome === "success") {
            target.set({ preferences: result.value.app, status: "ready" });
          } else {
            target.set((state) => withStatus(state, "error"));
          }
        })
        .catch(() => {
          if (active) target.set((state) => withStatus(state, "error"));
        });
      return () => {
        active = false;
      };
    },
    [capability, initialSnapshot],
  );

  const setApp = useCallback(
    (patch: Partial<AppPreferences>) => {
      const merged: AppPreferences = { ...store.get().preferences, ...patch };
      store.set((state) => ({ ...state, preferences: merged }));
      if (capability === undefined) return;
      const seq = ++writeSeqRef.current;
      void capability
        .write({ app: merged })
        .then((result) => {
          if (writeSeqRef.current !== seq) return;
          if (result.outcome === "success") {
            store.set((state) => ({ ...state, preferences: result.value.app }));
          }
        })
        .catch(() => {});
    },
    [capability, store],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, status, setApp }),
    [preferences, status, setApp],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  return use(PreferencesContext);
}

export interface CurrencyDisplayModeSelection {
  readonly requested: CurrencyDisplayMode;
  readonly effective: CurrencyDisplayMode;
  readonly fallbackReason?: CurrencyFallbackReason;
  readonly setRequested: (mode: CurrencyDisplayMode) => void;
}

export function useCurrencyDisplayMode(
  context: ActiveCampaignCurrencyContext = DEFAULT_CURRENCY_CONTEXT,
  source: NationalCurrencySource = NO_NATIONAL_CURRENCY_CONFIGURATIONS,
): CurrencyDisplayModeSelection {
  const { preferences, setApp } = usePreferences();
  const requested = preferences.currencyDisplayMode;
  const availability = computeNationalCurrencyAvailability(context, source);
  const effective = resolveEffectiveCurrencyDisplayMode(requested, availability);
  const setRequested = useCallback(
    (mode: CurrencyDisplayMode) => setApp({ currencyDisplayMode: mode }),
    [setApp],
  );
  return {
    requested,
    effective: effective.mode,
    ...(effective.fallbackReason !== undefined ? { fallbackReason: effective.fallbackReason } : {}),
    setRequested,
  };
}
