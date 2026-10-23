import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import { BridgeProvider } from "./bridge-context.js";
import { BRIDGE_UNAVAILABLE_MESSAGE, TRANSPORT_FAILURE_MESSAGE } from "./bridge-read.js";
import { primeQuery, readQuery, type ReadResult } from "./read-queries.js";
import { useRead } from "./use-read.js";

afterEach(cleanup);

const success = <T,>(value: T) => ({ outcome: "success" as const, value, diagnostics: [] });

function completed<T>(partial: Partial<T>): T {
  return partial as T;
}

function fakeBridge(handler: (command: string) => unknown) {
  const execute = vi.fn<CampaignCommandClient["execute"]>(
    async (command) => handler(command) as never,
  );
  const bridge = completed<BluewaveDesktopBridge>({ campaign: { execute } });
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <BridgeProvider bridge={bridge}>{children}</BridgeProvider>
  );
  return { bridge, execute, wrapper };
}

describe("shared read queries", () => {
  it("serves two hooks reading the same query at the same revision with one bridge call", async () => {
    const { execute, wrapper } = fakeBridge(() => success({ priorities: [] }));

    const { result } = renderHook(
      () => [useRead("inspectPriorities", "s1", 3), useRead("inspectPriorities", "s1", 3)],
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[0]?.status).toBe("ready");
      expect(result.current[1]?.status).toBe("ready");
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("serves a later hook from the retained result at the same revision", async () => {
    const { execute, wrapper } = fakeBridge(() => success({ priorities: [] }));

    const first = renderHook(() => useRead("inspectPriorities", "s1", 3), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    const second = renderHook(() => useRead("inspectPriorities", "s1", 3), { wrapper });
    await waitFor(() => expect(second.result.current.status).toBe("ready"));

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("keeps different queries and sessions apart", async () => {
    const { execute, wrapper } = fakeBridge(() => success({}));

    const { result } = renderHook(
      () => [
        useRead("inspectPriorities", "s1", 3),
        useRead("readMonthlyReports", "s1", 3),
        useRead("inspectPriorities", "s2", 3),
      ],
      { wrapper },
    );

    await waitFor(() => expect(result.current.every((read) => read.status === "ready")).toBe(true));
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("refetches when the revision changes", async () => {
    let n = 0;
    const { execute, wrapper } = fakeBridge(() => success({ n: (n += 1) }));

    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) => useRead("inspectCampaign", "s1", revision),
      { wrapper, initialProps: { revision: 1 } },
    );
    await waitFor(() => expect(result.current).toEqual({ status: "ready", value: { n: 1 } }));

    rerender({ revision: 2 });

    await waitFor(() => expect(result.current).toEqual({ status: "ready", value: { n: 2 } }));
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("always fetches fresh when the revision is unknown", async () => {
    const { bridge, execute } = fakeBridge(() => success({}));

    await readQuery(bridge.campaign, "inspectMap", "s1", null);
    await readQuery(bridge.campaign, "inspectMap", "s1", null);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("serves a primed result without calling the bridge", async () => {
    const { bridge, execute } = fakeBridge(() => success({}));
    primeQuery(bridge.campaign, "inspectPriorities", "s1", 5, { priorities: [] });

    const read = await readQuery(bridge.campaign, "inspectPriorities", "s1", 5);

    expect(read).toEqual({ status: "ready", value: { priorities: [] } });
    expect(execute).not.toHaveBeenCalled();
  });

  it("refetches after a failure instead of retaining it", async () => {
    let fail = true;
    const { bridge, execute } = fakeBridge(() =>
      fail ? { outcome: "rejected", reason: "NOPE", diagnostics: [] } : success({ ok: true }),
    );

    expect(await readQuery(bridge.campaign, "inspectMap", "s1", 1)).toEqual({
      status: "unavailable",
      reason: "NOPE",
    });
    fail = false;
    expect(await readQuery(bridge.campaign, "inspectMap", "s1", 1)).toEqual({
      status: "ready",
      value: { ok: true },
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("maps every failure kind to unavailable", async () => {
    const rejected = fakeBridge(() => ({ outcome: "rejected", reason: "NOPE", diagnostics: [] }));
    const thrown = fakeBridge(() => {
      throw new Error("boom");
    });
    const opaque = fakeBridge(() => {
      throw "not an error";
    });

    const reads: ReadonlyArray<ReadResult<unknown>> = [
      await readQuery(rejected.bridge.campaign, "inspectMap", "s1", 1),
      await readQuery(thrown.bridge.campaign, "inspectMap", "s1", 1),
      await readQuery(opaque.bridge.campaign, "inspectMap", "s1", 1),
      await readQuery(undefined, "inspectMap", "s1", 1),
    ];

    expect(reads).toEqual([
      { status: "unavailable", reason: "NOPE" },
      { status: "unavailable", reason: "boom" },
      { status: "unavailable", reason: TRANSPORT_FAILURE_MESSAGE },
      { status: "unavailable", reason: BRIDGE_UNAVAILABLE_MESSAGE },
    ]);
  });

  it("reports unavailable through the hook and skips the bridge while disabled", async () => {
    const { execute, wrapper } = fakeBridge(() => ({
      outcome: "rejected",
      reason: "NOPE",
      diagnostics: [],
    }));

    const disabled = renderHook(() => useRead("inspectMap", "s1", 1, { enabled: false }), {
      wrapper,
    });
    expect(disabled.result.current).toEqual({ status: "loading" });
    expect(execute).not.toHaveBeenCalled();

    const enabled = renderHook(() => useRead("inspectMap", "s1", 1), { wrapper });
    await waitFor(() =>
      expect(enabled.result.current).toEqual({ status: "unavailable", reason: "NOPE" }),
    );
  });

  it("refetches when the refresh token changes", async () => {
    let n = 0;
    const { execute, wrapper } = fakeBridge(() => success({ n: (n += 1) }));

    const { result, rerender } = renderHook(
      ({ token }: { token: number }) =>
        useRead("inspectCampaign", "s1", 1, { refreshToken: token }),
      { wrapper, initialProps: { token: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    rerender({ token: 1 });

    await waitFor(() => expect(result.current).toEqual({ status: "ready", value: { n: 2 } }));
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
