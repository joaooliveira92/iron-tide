import { useMemo, useState, useSyncExternalStore, type DependencyList } from "react";

import {
  createValueStore,
  subscribeWithLifecycle,
  type StoreLifecycle,
  type ValueStore,
} from "./value-store.js";

export function useStoreLifecycle<T>(
  initial: () => T,
  start: StoreLifecycle<T>,
  key: DependencyList,
): readonly [T, ValueStore<T>] {
  const [store] = useState(() => createValueStore(initial()));
  const subscribe = useMemo(() => subscribeWithLifecycle(store, start), [store, ...key]);
  return [useSyncExternalStore(subscribe, store.get), store];
}
