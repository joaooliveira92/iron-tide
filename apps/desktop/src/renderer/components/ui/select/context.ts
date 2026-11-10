import { createContext, useContext } from "react";

import type { SelectContextValue } from "./types.js";

export const SelectContext = createContext<SelectContextValue | null>(null);

export function useSelectContext(componentName: string): SelectContextValue {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error(`${componentName} must be used within <Select>.`);
  }

  return context;
}
