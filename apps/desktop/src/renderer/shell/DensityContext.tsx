import { createContext, type ReactNode, use, useCallback, useLayoutEffect, useMemo } from "react";

import type { InterfaceDensityPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

export type Density = InterfaceDensityPreference;

export const DENSITY_OPTIONS: readonly {
  readonly value: Density;
  readonly label: string;
  readonly description: string;
}[] = [
  { value: "comfortable", label: "Comfortable", description: "Roomy spacing, easiest to scan." },
  { value: "compact", label: "Compact", description: "Tighter spacing, more on screen." },
];

interface DensityContextValue {
  readonly density: Density;
  readonly setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({ children }: { children: ReactNode }) {
  const { preferences, setApp } = usePreferences();
  const density = preferences.interfaceDensity;

  useLayoutEffect(() => {
    document.documentElement.dataset["density"] = density;
  }, [density]);

  const setDensity = useCallback((next: Density) => setApp({ interfaceDensity: next }), [setApp]);

  const value = useMemo(() => ({ density, setDensity }), [density, setDensity]);

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityContextValue {
  const ctx = use(DensityContext);
  if (ctx === null) throw new Error("useDensity must be used within DensityProvider");
  return ctx;
}
