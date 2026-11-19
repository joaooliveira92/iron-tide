import { act, renderHook } from "@testing-library/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { createValueStore, subscribeWithLifecycle } from "./value-store.js";

describe("createValueStore", () => {
  it("reads the initial value and applies direct and updater writes", () => {
    const store = createValueStore(1);
    store.set(2);
    store.set((current) => current + 5);
    expect(store.get()).toBe(7);
  });

  it("notifies subscribers only when the value changes", () => {
    const store = createValueStore(1);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("subscribeWithLifecycle", () => {
  it("starts on subscribe, stops on unsubscribe and feeds the store", () => {
    const store = createValueStore(0);
    const stop = vi.fn();
    const start = vi.fn((target: typeof store) => {
      target.set(10);
      return stop;
    });
    const subscribe = subscribeWithLifecycle(store, start);
    const listener = vi.fn();

    const unsubscribe = subscribe(listener);
    expect(start).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(10);

    unsubscribe();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("drives a mounted component and restarts when the subscribe identity changes", () => {
    const store = createValueStore("idle");
    const stops: string[] = [];
    const { result, rerender } = renderHook(
      ({ tag }: { tag: string }) => {
        const subscribe = useMemo(
          () =>
            subscribeWithLifecycle(store, (target) => {
              target.set(`running:${tag}`);
              return () => stops.push(tag);
            }),
          [tag],
        );
        return useSyncExternalStore(subscribe, store.get);
      },
      { initialProps: { tag: "a" } },
    );

    expect(result.current).toBe("running:a");
    rerender({ tag: "b" });
    expect(stops).toEqual(["a"]);
    expect(result.current).toBe("running:b");
  });

  it("re-renders a consumer when the store is written after mount", () => {
    const store = createValueStore(0);
    const subscribe = subscribeWithLifecycle(store, () => undefined);
    const { result } = renderHook(() => {
      const value = useSyncExternalStore(subscribe, store.get);
      const [renders] = useState(0);
      return { value, renders };
    });
    act(() => store.set(4));
    expect(result.current.value).toBe(4);
  });
});
