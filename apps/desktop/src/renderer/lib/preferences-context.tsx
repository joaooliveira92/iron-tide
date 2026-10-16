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
  type AppPreferences,
  type PreferencesSnapshot,
  type WriteAppPreferencesRequest,
} from "../../shared/preferences-contract.js";
import { useBridge } from "./bridge-context.js";

export type PreferencesStatus = "loading" | "ready" | "error";

/** The narrow capability this provider consumes off the preload bridge (D6). */
interface PreferencesCapability {
  read(): Promise<BridgeResult<PreferencesSnapshot>>;
  write(request: WriteAppPreferencesRequest): Promise<BridgeResult<PreferencesSnapshot>>;
}

export interface PreferencesContextValue {
  readonly preferences: AppPreferences;
  readonly status: PreferencesStatus;
  readonly setApp: (patch: Partial<AppPreferences>) => void;
}

/**
 * The safe fallback for a tree with no `PreferencesProvider` (bare component
 * tests): the central defaults and a no-op writer. The app tree always wraps the
 * shell in a provider (see `main.tsx`), so the renderer reads one validated
 * source.
 */
const DEFAULT_CONTEXT_VALUE: PreferencesContextValue = {
  preferences: DEFAULT_APP_PREFERENCES,
  status: "ready",
  setApp: () => {},
};

const PreferencesContext = createContext<PreferencesContextValue>(DEFAULT_CONTEXT_VALUE);

/**
 * Reads the app-scope preferences through the preload capability on mount
 * (defaults while loading) and writes optimistic merges back through it. Imports
 * no `effect` and never touches `localStorage` (ADR-0159/D6).
 */
export function PreferencesProvider({ children }: { readonly children: ReactNode }) {
  const bridge = useBridge();
  const capability: PreferencesCapability | undefined = bridge?.preferences;
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [status, setStatus] = useState<PreferencesStatus>(
    capability === undefined ? "ready" : "loading",
  );
  // Latest preferences, read synchronously by `setApp` so a merge never races
  // React's state batching (the write is a side effect, not a reducer).
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  // Monotonic guard: an older in-flight read or write must never clobber a newer
  // local choice (a fast toggle must not be reverted by a slow earlier response).
  const writeSeqRef = useRef(0);

  useEffect(() => {
    if (capability === undefined) {
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
  }, [capability]);

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
        .catch(() => {
          // A failed write leaves the optimistic value in place for this session.
        });
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
