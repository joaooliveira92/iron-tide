import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { waitForQuiet } from "./snap-quiet.ts";

describe("waitForQuiet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div id='root'></div>";
  });
  afterEach(() => vi.useRealTimers());

  it("settles after one quiet window when nothing changes", async () => {
    const result = waitForQuiet({ quietMs: 100, maxMs: 1000 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual({ settled: true });
  });

  it("restarts the quiet window on every structural mutation", async () => {
    const root = document.getElementById("root")!;
    const result = waitForQuiet({ quietMs: 100, maxMs: 1000 });
    let done = false;
    void result.then(() => (done = true));
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(80);
      root.appendChild(document.createElement("span"));
      await Promise.resolve();
    }
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual({ settled: true });
  });

  it("ignores attribute-only churn such as continuous animation", async () => {
    const root = document.getElementById("root")!;
    const result = waitForQuiet({ quietMs: 100, maxMs: 1000 });
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(20);
      root.setAttribute("data-frame", String(i));
    }
    await vi.advanceTimersByTimeAsync(10);
    expect(await result).toEqual({ settled: true });
  });

  it("gives up at the ceiling and says it did not settle", async () => {
    const root = document.getElementById("root")!;
    const result = waitForQuiet({ quietMs: 100, maxMs: 500 });
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(60);
      root.appendChild(document.createElement("i"));
      await Promise.resolve();
    }
    expect(await result).toEqual({ settled: false });
  });
});
