import { createContext, type ReactNode, use, useState, useSyncExternalStore } from "react";
import { createSelectionStore, type SelectionState, type SelectionStore } from "./store.js";

const SelectionContext = createContext<SelectionStore | null>(null);

export function ShipSelectionProvider({
  store,
  children,
}: {
  readonly store: SelectionStore;
  readonly children: ReactNode;
}) {
  return <SelectionContext.Provider value={store}>{children}</SelectionContext.Provider>;
}

export function useSelectionStore(): SelectionStore {
  const shared = use(SelectionContext);
  const [own] = useState(() => (shared === null ? createSelectionStore() : null));
  return shared ?? own!;
}

export function useShipSelection<T>(pick: (s: SelectionState) => T): T {
  const store = useSelectionStore();
  return useSyncExternalStore(store.subscribe, () => pick(store.get()));
}
