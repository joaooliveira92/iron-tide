import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createTimedValue } from "./timed-value.js";

describe("timed value", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("clears a value after its lifetime and keeps one with no lifetime", () => {
    const store = createTimedValue<string>((value) => (value === "keep" ? null : 100));
    const unsubscribe = store.subscribe(() => undefined);
    store.show("fade");
    expect(store.get()).toBe("fade");
    vi.advanceTimersByTime(100);
    expect(store.get()).toBeNull();
    store.show("keep");
    vi.advanceTimersByTime(10_000);
    expect(store.get()).toBe("keep");
    unsubscribe();
  });

  it("restarts the countdown on a new value and drops the timer on unsubscribe", () => {
    const store = createTimedValue<string>(() => 100);
    const unsubscribe = store.subscribe(() => undefined);
    store.show("a");
    vi.advanceTimersByTime(60);
    store.show("b");
    vi.advanceTimersByTime(60);
    expect(store.get()).toBe("b");
    vi.advanceTimersByTime(40);
    expect(store.get()).toBeNull();
    store.show("c");
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dismisses on request", () => {
    const store = createTimedValue<string>(() => 100);
    store.show("a");
    store.dismiss();
    expect(store.get()).toBeNull();
  });
});
