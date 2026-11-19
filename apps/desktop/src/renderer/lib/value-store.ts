export interface ValueStore<T> {
  readonly get: () => T;
  readonly set: (next: T | ((current: T) => T)) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export type StoreLifecycle<T> = (store: ValueStore<T>) => (() => void) | void;

export function createValueStore<T>(initial: T): ValueStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      for (const listener of Array.from(listeners)) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function subscribeWithLifecycle<T>(
  store: ValueStore<T>,
  start: StoreLifecycle<T>,
): (listener: () => void) => () => void {
  return (listener) => {
    const unsubscribe = store.subscribe(listener);
    const stop = start(store);
    return () => {
      unsubscribe();
      stop?.();
    };
  };
}

export const NO_SUBSCRIPTION = (): (() => void) => () => undefined;
