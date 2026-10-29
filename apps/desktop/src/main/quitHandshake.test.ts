import { describe, expect, it } from "vite-plus/test";
import {
  installQuitHandshake,
  type QuitApp,
  type QuitEvent,
  type QuitWindow,
} from "./quitHandshake.js";
import type { DelayedScheduler } from "./scheduler.js";

class FakeApp implements QuitApp {
  readonly listeners: Array<(event: QuitEvent) => void> = [];
  quits = 0;

  on(event: "before-quit", listener: (event: QuitEvent) => void): void {
    if (event === "before-quit") this.listeners.push(listener);
  }

  removeListener(event: "before-quit", listener: (event: QuitEvent) => void): void {
    if (event !== "before-quit") return;
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  quit(): void {
    this.quits += 1;
  }

  requestQuit(prevented: string[]): void {
    const event = { preventDefault: () => prevented.push("prevented") };
    for (const listener of [...this.listeners]) listener(event);
  }
}

class FakeRuntime {
  disposals = 0;

  dispose(): Promise<void> {
    this.disposals += 1;
    return Promise.resolve();
  }
}

class FakeWindow implements QuitWindow {
  destroyed = false;
  webContentsDestroyed = false;
  readonly sent: string[] = [];
  readonly webContents = {
    isDestroyed: () => this.webContentsDestroyed,
    send: (channel: string) => void this.sent.push(channel),
  };

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

class FakeScheduler implements DelayedScheduler {
  readonly pending: Array<() => void> = [];
  readonly cleared: unknown[] = [];

  setTimeout(callback: () => void): number {
    this.pending.push(callback);
    return this.pending.length;
  }

  clearTimeout(handle: unknown): void {
    this.cleared.push(handle);
  }

  runAll(): void {
    for (const callback of this.pending.splice(0)) callback();
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function install(windows: readonly QuitWindow[]) {
  const app = new FakeApp();
  const runtime = new FakeRuntime();
  const scheduler = new FakeScheduler();
  const flushed: string[] = [];
  const handshake = installQuitHandshake({
    app,
    runtime,
    windows: () => windows,
    sendFlush: (window) => flushed.push("flush"),
    scheduler,
    timeoutMs: 1_500,
  });
  return { app, runtime, scheduler, flushed, handshake };
}

describe("installQuitHandshake", () => {
  it("flushes the renderer, then disposes the runtime and quits on complete", async () => {
    const window = new FakeWindow();
    const table = install([window]);
    const prevented: string[] = [];

    table.app.requestQuit(prevented);
    expect(prevented).toEqual(["prevented"]);
    expect(table.flushed).toEqual(["flush"]);
    expect(table.handshake.isQuitting()).toBe(true);
    expect(table.runtime.disposals).toBe(0);

    table.handshake.complete();
    await flush();
    expect(table.runtime.disposals).toBe(1);
    expect(table.app.quits).toBe(1);
  });

  it("quits within the bound when the renderer never replies", async () => {
    const window = new FakeWindow();
    const table = install([window]);

    table.app.requestQuit([]);
    expect(table.runtime.disposals).toBe(0);
    table.scheduler.runAll();
    await flush();
    expect(table.runtime.disposals).toBe(1);
    expect(table.app.quits).toBe(1);
  });

  it("ignores a late or duplicate flush reply", async () => {
    const window = new FakeWindow();
    const table = install([window]);

    table.app.requestQuit([]);
    table.handshake.complete();
    await flush();
    table.handshake.complete();
    table.scheduler.runAll();
    await flush();

    expect(table.runtime.disposals).toBe(1);
    expect(table.app.quits).toBe(1);
  });

  it("does not extend the bound when quit is requested twice", async () => {
    const window = new FakeWindow();
    const table = install([window]);
    table.app.requestQuit([]);
    const firstTimer = table.scheduler.pending.length;

    const prevented: string[] = [];
    table.app.requestQuit(prevented);
    expect(prevented).toEqual(["prevented"]);
    expect(table.flushed).toEqual(["flush"]);
    expect(table.scheduler.pending).toHaveLength(firstTimer);
  });

  it("disposes the runtime and quits when no live window exists", async () => {
    const table = install([]);
    const prevented: string[] = [];

    table.app.requestQuit(prevented);
    await flush();
    expect(prevented).toEqual(["prevented"]);
    expect(table.flushed).toEqual([]);
    expect(table.runtime.disposals).toBe(1);
    expect(table.app.quits).toBe(1);
  });

  it("treats a destroyed window or web contents as no live window", async () => {
    const destroyed = new FakeWindow();
    destroyed.destroyed = true;
    const gone = new FakeWindow();
    gone.webContentsDestroyed = true;
    const table = install([destroyed, gone]);

    table.app.requestQuit([]);
    await flush();
    expect(table.runtime.disposals).toBe(1);
    expect(table.app.quits).toBe(1);
  });

  it("removes the before-quit listener once the handshake finishes", async () => {
    const window = new FakeWindow();
    const table = install([window]);
    expect(table.app.listeners).toHaveLength(1);

    table.handshake.forceQuit();
    await flush();
    expect(table.app.listeners).toHaveLength(0);
    expect(table.runtime.disposals).toBe(1);
    expect(table.app.quits).toBe(1);
  });

  it("dispose clears the timer and drops the listener without quitting", () => {
    const window = new FakeWindow();
    const table = install([window]);
    table.app.requestQuit([]);
    table.handshake.dispose();

    expect(table.scheduler.cleared).toHaveLength(1);
    expect(table.app.listeners).toHaveLength(0);
    expect(table.runtime.disposals).toBe(0);
    expect(table.app.quits).toBe(0);
  });
});
