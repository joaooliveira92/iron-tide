import { describe, expect, it } from "vite-plus/test";
import type { DelayedScheduler } from "./scheduler.js";
import {
  installUnresponsiveRecovery,
  type RecoveryDialog,
  type RecoveryMessageBoxOptions,
  type StackSampler,
  type UnresponsiveWindow,
} from "./unresponsiveRecovery.js";

class FakeWindow implements UnresponsiveWindow {
  destroyed = false;
  reloads = 0;
  readonly listeners = new Map<string, Array<() => void>>();
  readonly webContents = { isDestroyed: () => false };

  isDestroyed(): boolean {
    return this.destroyed;
  }

  on(event: "unresponsive" | "responsive", listener: () => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  removeListener(event: "unresponsive" | "responsive", listener: () => void): void {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((candidate) => candidate !== listener),
    );
  }

  fire(event: "unresponsive" | "responsive"): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

class FakeSampler implements StackSampler {
  starts = 0;
  stops = 0;
  samples: string[] = ["stack sample 1", "stack sample 2"];

  start(): void {
    this.starts += 1;
  }

  stop(): readonly string[] {
    this.stops += 1;
    const flushed = this.samples;
    this.samples = [];
    return flushed;
  }

  snapshot(): readonly string[] {
    return [...this.samples];
  }
}

class FakeScheduler implements DelayedScheduler {
  readonly pending: Array<{ readonly id: number; readonly callback: () => void }> = [];
  readonly cleared: unknown[] = [];
  nextId = 1;

  setTimeout(callback: () => void): number {
    const id = this.nextId++;
    this.pending.push({ id, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.cleared.push(handle);
    const id = handle as number;
    const index = this.pending.findIndex((entry) => entry.id === id);
    if (index >= 0) this.pending.splice(index, 1);
  }

  runNext(): void {
    this.pending.shift()?.callback();
  }
}

function install(responses: number[] = [0]) {
  const window = new FakeWindow();
  const sampler = new FakeSampler();
  const scheduler = new FakeScheduler();
  const logs: string[] = [];
  const errors: Array<{ title: string; content: string }> = [];
  const prompts: RecoveryMessageBoxOptions[] = [];
  const dialog: RecoveryDialog = {
    showMessageBox: (options) => {
      prompts.push(options);
      return Promise.resolve({ response: responses.shift() ?? 0 });
    },
    showErrorBox: (title, content) => errors.push({ title, content }),
  };
  const exports: string[] = [];
  let quitCalls = 0;
  const recovery = installUnresponsiveRecovery({
    window,
    dialog,
    sampler,
    log: (message) => logs.push(message),
    exportSupportBundle: () => {
      exports.push("called");
      return Promise.resolve("/tmp/support/crash.json");
    },
    quit: () => {
      quitCalls += 1;
    },
    scheduler,
    rePromptDelayMs: 30_000,
  });
  return {
    window,
    sampler,
    scheduler,
    logs,
    errors,
    prompts,
    exports,
    recovery,
    quitCalls: () => quitCalls,
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("installUnresponsiveRecovery", () => {
  it("offers keep waiting, export and quit without reloading", async () => {
    const table = install([0]);
    table.window.fire("unresponsive");
    await flush();

    expect(table.window.reloads).toBe(0);
    expect(table.sampler.starts).toBe(1);
    expect(table.prompts).toHaveLength(1);
    expect(table.prompts[0]?.buttons).toEqual(["Keep waiting", "Export support bundle", "Quit"]);
    expect(table.logs.join("\n")).toContain("sampling stacks instead of reloading");
  });

  it("keeps sampling and raises the dialog again after keep waiting", async () => {
    const table = install([0, 0]);
    table.window.fire("unresponsive");
    await flush();
    expect(table.prompts).toHaveLength(1);
    expect(table.scheduler.pending).toHaveLength(1);

    table.scheduler.runNext();
    await flush();
    expect(table.prompts).toHaveLength(2);
    expect(table.sampler.stops).toBe(0);
    expect(table.window.reloads).toBe(0);
  });

  it("exports a support bundle and shows where it was saved", async () => {
    const table = install([1, 0]);
    table.window.fire("unresponsive");
    await flush();

    expect(table.exports).toHaveLength(1);
    expect(table.errors).toEqual([
      { title: "Bluewave", content: "A support bundle was saved to:\n/tmp/support/crash.json" },
    ]);
    expect(table.scheduler.pending).toHaveLength(1);
  });

  it("quits without scheduling another prompt", async () => {
    const table = install([2]);
    table.window.fire("unresponsive");
    await flush();

    expect(table.quitCalls()).toBe(1);
    expect(table.scheduler.pending).toHaveLength(0);
  });

  it("stops sampling and flushes the samples when the window responds", async () => {
    const table = install([0]);
    table.window.fire("unresponsive");
    await flush();
    table.window.fire("responsive");

    expect(table.sampler.stops).toBe(1);
    expect(table.scheduler.pending).toHaveLength(0);
    expect(table.logs).toContain("stack sample 1");
    expect(table.logs).toContain("stack sample 2");
    expect(table.logs.join("\n")).toContain("flushed 2 stack sample(s)");
  });

  it("clears the re-prompt timer and removes listeners on dispose", async () => {
    const table = install([0]);
    table.window.fire("unresponsive");
    await flush();
    table.recovery.dispose();

    expect(table.sampler.stops).toBe(1);
    expect(table.window.listeners.get("unresponsive")).toEqual([]);
    expect(table.window.listeners.get("responsive")).toEqual([]);
  });
});
