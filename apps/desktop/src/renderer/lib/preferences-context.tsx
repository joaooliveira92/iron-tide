import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  computeNationalCurrencyAvailability,
  NO_NATIONAL_CURRENCY_CONFIGURATIONS,
  type ActiveCampaignCurrencyContext,
  type NationalCurrencySource,
} from "./presentation-format/index.js";
import { useBridge } from "./bridge-context.js";

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

const DEFAULT_CONTEXT_VALUE: PreferencesContextValue = {
  preferences: DEFAULT_APP_PREFERENCES,
  status: "ready",
  setApp: () => {},
};

const PreferencesContext = createContext<PreferencesContextValue>(DEFAULT_CONTEXT_VALUE);

export function PreferencesProvider({
  children,
  initialSnapshot,
}: {
  readonly children: ReactNode;
  readonly initialSnapshot?: PreferencesSnapshot | undefined;
}) {
  const bridge = useBridge();
  const capability: PreferencesCapability | undefined = bridge?.preferences;
  const [preferences, setPreferences] = useState<AppPreferences>(
    initialSnapshot?.app ?? DEFAULT_APP_PREFERENCES,
  );
  const [status, setStatus] = useState<PreferencesStatus>(
    capability === undefined || initialSnapshot !== undefined ? "ready" : "loading",
  );
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const writeSeqRef = useRef(0);

  useEffect(() => {
    if (capability === undefined) {
      setStatus("ready");
      return;
    }
    if (initialSnapshot !== undefined) {
      preferencesRef.current = initialSnapshot.app;
      setPreferences(initialSnapshot.app);
      setStatus("ready");
      return;
    }
    let active = true;
    setStatus("loading");
    const seqAtStart = writeSeqRef.current;
    void capability
      .read()
      .then((result) => {
        if (!active) return;
        if (writeSeqRef.current !== seqAtStart) return;
        if (result.outcome === "success") {
          preferencesRef.current = result.value.app;
          setPreferences(result.value.app);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [capability, initialSnapshot]);

  const setApp = useCallback(
    (patch: Partial<AppPreferences>) => {
      const merged: AppPreferences = { ...preferencesRef.current, ...patch };
      preferencesRef.current = merged;
      setPreferences(merged);
      if (capability === undefined) return;
      const seq = ++writeSeqRef.current;
      void capability
        .write({ app: merged })
        .then((result) => {
          if (writeSeqRef.current !== seq) return;
          if (result.outcome === "success") {
            preferencesRef.current = result.value.app;
            setPreferences(result.value.app);
          }
        })
        .catch(() => {});
    },
    [capability],
  );

  return (
    <PreferencesContext.Provider value={{ preferences, status, setApp }}>
      {children}
    </PreferencesContext.Provider>
  );
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
  context: ActiveCampaignCurrencyContext = {},
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
