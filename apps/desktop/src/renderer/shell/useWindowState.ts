import { useSyncExternalStore } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { WindowState } from "../../shared/bridge-contract.js";

interface WindowStateStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => WindowState | null;
}

const IDLE_STORE: WindowStateStore = {
  subscribe: () => () => {},
  getSnapshot: () => null,
};

function createWindowStateStore(bridge: BluewaveDesktopBridge): WindowStateStore {
  const listeners = new Set<() => void>();
  let state: WindowState | null = null;
  let generation = 0;

  async function load(token: number): Promise<void> {
    try {
      const loaded = await bridge.getWindowState();
      if (token !== generation) return;
      state = loaded;
      for (const listener of listeners) listener();
    } catch {}
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) void load(generation);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          generation += 1;
          state = null;
        }
      };
    },
    getSnapshot: () => state,
  };
}

const stores = new WeakMap<BluewaveDesktopBridge, WindowStateStore>();

function storeFor(bridge: BluewaveDesktopBridge): WindowStateStore {
  const existing = stores.get(bridge);
  if (existing !== undefined) return existing;
  const created = createWindowStateStore(bridge);
  stores.set(bridge, created);
  return created;
}

export function useLoadedWindowState(
  bridge: BluewaveDesktopBridge | undefined,
  skip: boolean,
): WindowState | null {
  const store = skip || bridge === undefined ? IDLE_STORE : storeFor(bridge);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
