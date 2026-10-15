import { createContext, type ReactNode, use, useLayoutEffect, useState } from "react";

/**
 * Information density (spec V-3). "compact" tightens spacing everywhere through
 * Tailwind's single `--spacing` variable (see styles/globals.css), so veterans get
 * the RTW3-style dense view without every screen needing its own variant.
 */
export type Density = "comfortable" | "compact";

export const DENSITY_STORAGE_KEY = "bluewave-density";

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

/** The stored choice, or "comfortable" for anything missing or unrecognised. */
export function readStoredDensity(): Density {
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    return stored === "compact" || stored === "comfortable" ? stored : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>(readStoredDensity);

  // Layout effect: set the attribute before first paint so there is no flash of the wrong density.
  useLayoutEffect(() => {
    document.documentElement.dataset["density"] = density;
  }, [density]);

  const setDensity = (next: Density) => {
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
    setDensityState(next);
  };

  return (
    <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const ctx = use(DensityContext);
  if (ctx === null) throw new Error("useDensity must be used within DensityProvider");
  return ctx;
}
