import { BluewaveError } from "@bluewave/contracts";
import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

interface FleetFocusValue {
  readonly focusShipId: string | null;
  readonly focusShip: (shipId: string) => void;
  readonly clearFocus: () => void;
}

const FleetFocusContext = createContext<FleetFocusValue | null>(null);

export function FleetFocusProvider({ children }: { readonly children: ReactNode }) {
  const [focusShipId, setFocusShipId] = useState<string | null>(null);
  const focusShip = useCallback((shipId: string) => setFocusShipId(shipId), []);
  const clearFocus = useCallback(() => setFocusShipId(null), []);
  const value = useMemo(
    () => ({ focusShipId, focusShip, clearFocus }),
    [focusShipId, focusShip, clearFocus],
  );
  return <FleetFocusContext.Provider value={value}>{children}</FleetFocusContext.Provider>;
}

export function useFleetFocus(): FleetFocusValue {
  const ctx = use(FleetFocusContext);
  if (ctx === null) {
    throw new BluewaveError("FLEET_FOCUS_PROVIDER_MISSING", { hook: "useFleetFocus" });
  }
  return ctx;
}
