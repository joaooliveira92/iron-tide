import { describe, expect, it, vi } from "vite-plus/test";
import { installAppFlushListener, registerAppFlush, runAppFlushes } from "./app-flush.js";

describe("app flush registry", () => {
  it("runs every registered flush", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = registerAppFlush(a);
    const offB = registerAppFlush(b);
    await runAppFlushes();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    offA();
    offB();
  });

  it("isolates a failing flush", async () => {
    const boom = vi.fn(() => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    const offBoom = registerAppFlush(boom);
    const offOk = registerAppFlush(ok);
    await expect(runAppFlushes()).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledOnce();
    offBoom();
    offOk();
  });

  it("awaits asynchronous flushes", async () => {
    let done = false;
    const off = registerAppFlush(async () => {
      await Promise.resolve();
      done = true;
    });
    await runAppFlushes();
    expect(done).toBe(true);
    off();
  });

  it("stops running an unregistered flush", async () => {
    const flush = vi.fn();
    const off = registerAppFlush(flush);
    off();
    await runAppFlushes();
    expect(flush).not.toHaveBeenCalled();
  });
});

describe("installAppFlushListener", () => {
  it("registers once and acknowledges a flush request", async () => {
    let flushHandler: (() => void) | undefined;
    const notify = vi.fn();
    const bridge = {
      onQuitFlush: (handler: () => void) => {
        flushHandler = handler;
      },
      notifyQuitFlushComplete: notify,
    };
    installAppFlushListener(bridge);

    expect(flushHandler).toBeTypeOf("function");
    const flush = vi.fn();
    const off = registerAppFlush(flush);
    flushHandler?.();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce());
    expect(flush).toHaveBeenCalledOnce();
    off();
  });
});
