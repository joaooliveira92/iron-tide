import { createContext, type ReactNode, use, useState, useSyncExternalStore } from "react";
import { createSelectionStore, type SelectionState, type SelectionStore } from "./store.js";

const SelectionContext = createContext<SelectionStore | null>(null);

/** Provides one Drawing Board's selection store. The value never changes, so the provider re-renders nothing. */
export function ShipSelectionProvider({
  store,
  children,
}: {
  readonly store: SelectionStore;
  readonly children: ReactNode;
}) {
  return <SelectionContext.Provider value={store}>{children}</SelectionContext.Provider>;
}

/**
 * The board's selection store; outside a board (a panel rendered on its own) each caller gets a private one,
 * so panels stay usable in isolation.
 */
export function useSelectionStore(): SelectionStore {
  const shared = use(SelectionContext);
  const [own] = useState(() => (shared === null ? createSelectionStore() : null));
  return shared ?? own!;
}

/** Subscribes to one slice of the selection; the caller re-renders only when that slice changes. */
export function useShipSelection<T>(pick: (s: SelectionState) => T): T {
  const store = useSelectionStore();
  return useSyncExternalStore(store.subscribe, () => pick(store.get()));
}
