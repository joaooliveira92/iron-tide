import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { BRIDGE_UNAVAILABLE_MESSAGE, TRANSPORT_FAILURE_MESSAGE } from "./bridge-read.js";
import { useBridgeQuery } from "./use-bridge-query.js";

const originalBridge = window.bluewave;

afterEach(() => {
  cleanup();
  if (originalBridge === undefined) {
    delete window.bluewave;
  } else {
    window.bluewave = originalBridge;
  }
});

function bridgeWith(execute: (name: string, payload: unknown) => unknown): void {
  window.bluewave = { campaign: { execute } } as unknown as BluewaveDesktopBridge;
}

describe("useBridgeQuery", () => {
  it("resolves to ready with the command's value", async () => {
    const execute = vi.fn();
    bridgeWith(execute);
    const run = vi.fn(async (): Promise<BridgeResult<{ n: number }>> => ({
      outcome: "success",
      value: { n: 1 },
      diagnostics: [],
    }));

    const { result } = renderHook(() => useBridgeQuery("s1", 0, run));

    await waitFor(() => expect(result.current).toEqual({ status: "ready", value: { n: 1 } }));
    expect(run).toHaveBeenCalledWith(window.bluewave, "s1");
  });

  it("resolves to error with the engine reason on any non-success outcome", async () => {
    bridgeWith(vi.fn());
    const run = vi.fn(async (): Promise<BridgeResult<number>> => ({
      outcome: "rejected",
      reason: "NOPE",
      diagnostics: [],
    }));

    const { result } = renderHook(() => useBridgeQuery("s1", 0, run));

    await waitFor(() => expect(result.current).toEqual({ status: "error", message: "NOPE" }));
  });

  it("captures a thrown Error's message", async () => {
    bridgeWith(vi.fn());
    const run = vi.fn(async (): Promise<BridgeResult<number>> => {
      throw new Error("boom");
    });

    const { result } = renderHook(() => useBridgeQuery("s1", 0, run));

    await waitFor(() => expect(result.current).toEqual({ status: "error", message: "boom" }));
  });

  it("falls back to the shared transport-failure message for a non-Error throw", async () => {
    bridgeWith(vi.fn());
    const run = vi.fn(async (): Promise<BridgeResult<number>> => {
      throw "not an error";
    });

    const { result } = renderHook(() => useBridgeQuery("s1", 0, run));

    await waitFor(() =>
      expect(result.current).toEqual({ status: "error", message: TRANSPORT_FAILURE_MESSAGE }),
    );
  });

  it("reports the shared unavailable message and never calls the command when the bridge is absent", async () => {
    delete window.bluewave;
    const run = vi.fn();

    const { result } = renderHook(() => useBridgeQuery("s1", 0, run));

    await waitFor(() =>
      expect(result.current).toEqual({ status: "error", message: BRIDGE_UNAVAILABLE_MESSAGE }),
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("re-runs when the revision changes", async () => {
    bridgeWith(vi.fn());
    let value = 1;
    const run = vi.fn(async (): Promise<BridgeResult<number>> => ({
      outcome: "success",
      value,
      diagnostics: [],
    }));

    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) => useBridgeQuery("s1", revision, run),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current).toEqual({ status: "ready", value: 1 }));

    value = 2;
    rerender({ revision: 1 });

    await waitFor(() => expect(result.current).toEqual({ status: "ready", value: 2 }));
    expect(run).toHaveBeenCalledTimes(2);
  });
});
