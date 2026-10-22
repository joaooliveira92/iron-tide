import { describe, expect, it, vi } from "vite-plus/test";

import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  BRIDGE_UNAVAILABLE_MESSAGE,
  TRANSPORT_FAILURE_MESSAGE,
  describeTransportFailure,
  foldBridgeResult,
  loadThroughBridge,
  readBridge,
} from "./bridge-read.js";

const success = (value: number): BridgeResult<number> => ({
  outcome: "success",
  value,
  diagnostics: [],
});

describe("bridge-read", () => {
  it("folds a success into ready and any other outcome into unavailable with the reason", () => {
    expect(foldBridgeResult(success(1))).toEqual({ status: "ready", value: 1 });
    expect(
      foldBridgeResult<number>({ outcome: "rejected", reason: "NOPE", diagnostics: [] }),
    ).toEqual({ status: "unavailable", reason: "NOPE" });
  });

  it("reads ready through the bridge", async () => {
    const run = vi.fn(async (_bridge: object) => success(2));
    const bridge = {};

    await expect(readBridge(bridge, run)).resolves.toEqual({ status: "ready", value: 2 });
    expect(run).toHaveBeenCalledWith(bridge);
  });

  it("reports the shared message and never runs when the bridge is absent", async () => {
    const run = vi.fn();

    await expect(readBridge(undefined, run)).resolves.toEqual({
      status: "unavailable",
      reason: BRIDGE_UNAVAILABLE_MESSAGE,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("captures a thrown Error's message and falls back for a non-Error throw", async () => {
    await expect(
      readBridge({}, async () => {
        throw new Error("boom");
      }),
    ).resolves.toEqual({ status: "unavailable", reason: "boom" });
    await expect(
      readBridge({}, async () => {
        throw "not an error";
      }),
    ).resolves.toEqual({ status: "unavailable", reason: TRANSPORT_FAILURE_MESSAGE });
  });

  it("rejects a screen load with the shared message when the bridge is absent", async () => {
    await expect(loadThroughBridge(undefined, async () => success(1))).rejects.toThrow(
      BRIDGE_UNAVAILABLE_MESSAGE,
    );
    await expect(loadThroughBridge({}, async () => success(1))).resolves.toEqual(success(1));
  });

  it("preserves an Error thrown by a screen load", async () => {
    const failure = new Error("boom");

    await expect(
      loadThroughBridge({}, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it("converts a non-Error failure of a screen load to the shared transport message", async () => {
    await expect(
      loadThroughBridge({}, async () => {
        throw "not an error";
      }),
    ).rejects.toThrow(TRANSPORT_FAILURE_MESSAGE);
    await expect(loadThroughBridge({}, () => Promise.reject("not an error"))).rejects.toThrow(
      TRANSPORT_FAILURE_MESSAGE,
    );
  });

  it("describes any thrown value with one message", () => {
    expect(describeTransportFailure(new Error("boom"))).toBe("boom");
    expect(describeTransportFailure(42)).toBe(TRANSPORT_FAILURE_MESSAGE);
  });
});
