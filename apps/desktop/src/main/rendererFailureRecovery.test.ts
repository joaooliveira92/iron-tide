import { describe, expect, it } from "vite-plus/test";
import {
  installRendererFailureRecovery,
  type FailureRecoveryWindow,
} from "./rendererFailureRecovery.js";

type Listener = (...args: any[]) => void;

class FakeWindow implements FailureRecoveryWindow {
  destroyed = false;
  reloads = 0;
  readonly listeners = new Map<string, Listener[]>();
  readonly webContentsListeners = new Map<string, Listener[]>();

  isDestroyed(): boolean {
    return this.destroyed;
  }

  reload(): void {
    this.reloads += 1;
  }

  on(event: string, listener: Listener): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  readonly webContents = {
    on: (event: string, listener: Listener): void => {
      this.webContentsListeners.set(event, [
        ...(this.webContentsListeners.get(event) ?? []),
        listener,
      ]);
    },
  };

  fire(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      (listener as (...values: unknown[]) => void)(...args);
    }
  }

  fireContents(event: string, ...args: unknown[]): void {
    for (const listener of this.webContentsListeners.get(event) ?? []) {
      (listener as (...values: unknown[]) => void)(...args);
    }
  }
}

function install(window: FakeWindow, options: { isDev?: boolean } = {}) {
  const fatals: string[] = [];
  const devUnavailable: string[] = [];
  const logs: string[] = [];
  const recovery = installRendererFailureRecovery({
    window,
    isDev: options.isDev ?? false,
    isQuitting: () => false,
    onFatal: (message) => fatals.push(message),
    onDevServerUnavailable: (description) => devUnavailable.push(description),
    log: (message) => logs.push(message),
  });
  return { recovery, fatals, devUnavailable, logs };
}

describe("installRendererFailureRecovery", () => {
  it("reloads once for a gone renderer process, then gives up", () => {
    const window = new FakeWindow();
    const { recovery, fatals } = install(window);

    window.fireContents("render-process-gone", {}, { reason: "crashed" });
    expect(window.reloads).toBe(1);
    expect(recovery.recoveries()).toBe(1);

    window.fireContents("render-process-gone", {}, { reason: "crashed" });
    expect(window.reloads).toBe(1);
    expect(fatals).toEqual(["The window could not recover (renderer process gone (crashed))."]);
  });

  it("resets the recovery budget after the window responds", () => {
    const window = new FakeWindow();
    const { recovery } = install(window);

    window.fireContents("render-process-gone", {}, { reason: "crashed" });
    window.fire("responsive");
    expect(recovery.recoveries()).toBe(0);

    window.fireContents("render-process-gone", {}, { reason: "crashed" });
    expect(window.reloads).toBe(2);
  });

  it("ignores sub-frame and aborted load failures", () => {
    const window = new FakeWindow();
    install(window);

    window.fireContents("did-fail-load", {}, -102, "ERR_CONNECTION_REFUSED", "url", false);
    window.fireContents("did-fail-load", {}, -3, "ERR_ABORTED", "url", true);
    expect(window.reloads).toBe(0);
  });

  it("reloads after an actionable load failure in production", () => {
    const window = new FakeWindow();
    install(window);

    window.fireContents("did-fail-load", {}, -102, "ERR_CONNECTION_REFUSED", "url", true);
    expect(window.reloads).toBe(1);
  });

  it("quits instead of reloading when the dev server is unavailable", () => {
    const window = new FakeWindow();
    const { devUnavailable } = install(window, { isDev: true });

    window.fireContents("did-fail-load", {}, -102, "ERR_CONNECTION_REFUSED", "url", true);
    expect(window.reloads).toBe(0);
    expect(devUnavailable).toEqual(["ERR_CONNECTION_REFUSED"]);
  });

  it("never listens to unresponsive, so a hung window cannot trigger a reload", () => {
    const window = new FakeWindow();
    install(window);
    expect(window.listeners.has("unresponsive")).toBe(false);
    expect(window.webContentsListeners.has("unresponsive")).toBe(false);
  });
});
