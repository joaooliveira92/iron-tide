import { createValueStore } from "./value-store.js";

export interface TimedValue<T> {
  readonly get: () => T | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly show: (value: T) => void;
  readonly dismiss: () => void;
}

export function createTimedValue<T>(lifetimeMs: (value: T) => number | null): TimedValue<T> {
  const store = createValueStore<T | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = (): void => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    get: store.get,
    subscribe: (listener) => {
      const unsubscribe = store.subscribe(listener);
      return () => {
        unsubscribe();
        clear();
      };
    },
    show: (value) => {
      store.set(value);
      clear();
      const lifetime = lifetimeMs(value);
      if (lifetime === null) return;
      timer = setTimeout(() => {
        timer = undefined;
        store.set(null);
      }, lifetime);
    },
    dismiss: () => store.set(null),
  };
}
