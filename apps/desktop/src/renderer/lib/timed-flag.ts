import { createValueStore } from "./value-store.js";

export interface TimedFlag {
  readonly get: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly raise: () => void;
}

export function createTimedFlag(durationMs: number): TimedFlag {
  const store = createValueStore(false);
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
    raise: () => {
      clear();
      store.set(true);
      timer = setTimeout(() => {
        timer = undefined;
        store.set(false);
      }, durationMs);
    },
  };
}
