import { createContext, type ReactNode, use, useLayoutEffect } from "react";

import type { InterfaceDensityPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

/**
 * Information density (spec V-3). "compact" tightens spacing everywhere through
 * Tailwind's single `--spacing` variable (see styles/globals.css), so veterans get
 * the RTW3-style dense view without every screen needing its own variant.
 */
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

  // Layout effect: set the attribute before first paint so there is no flash of the wrong density.
  useLayoutEffect(() => {
    document.documentElement.dataset["density"] = density;
  }, [density]);

  const setDensity = (next: Density) => setApp({ interfaceDensity: next });

  return (
    <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const ctx = use(DensityContext);
  if (ctx === null) throw new Error("useDensity must be used within DensityProvider");
  return ctx;
}
