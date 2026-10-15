import type { BridgeResult } from "../../../../shared/bridge-contract.js";
import { describe, expect, it, vi } from "vite-plus/test";
import { describeSandboxFailure, foldSandboxResult } from "./sandbox-command.js";

describe("foldSandboxResult", () => {
  it("adopts a success value through the success fold", () => {
    const success = vi.fn((state: string, value: number) => `${state}:${value}`);
    const failure = vi.fn((state: string, error: string) => `${state}:${error}`);
    const result: BridgeResult<number> = { outcome: "success", value: 7, diagnostics: [] };

    const next = foldSandboxResult(result, { success, failure })("start");

    expect(next).toBe("start:7");
    expect(failure).not.toHaveBeenCalled();
  });

  it("formats a rejection with its diagnostics through the failure fold", () => {
    const result: BridgeResult<number> = {
      outcome: "rejected",
      reason: "WAR_NOT_FOUND",
      diagnostics: ["no such war", "check the id"],
    };

    const next = foldSandboxResult(result, {
      success: () => "unused",
      failure: (_state: string, error) => error,
    })("start");

    expect(next).toBe("WAR_NOT_FOUND — no such war check the id");
  });

  it("routes a transport error through the same failure fold", () => {
    const result: BridgeResult<number> = {
      outcome: "error",
      reason: "BRIDGE_UNAVAILABLE",
      diagnostics: ["ipc closed"],
    };

    const next = foldSandboxResult(result, {
      success: () => "unused",
      failure: (_state: string, error) => error,
    })("start");

    expect(next).toBe("BRIDGE_UNAVAILABLE — ipc closed");
  });

  it("formats a transport error and a bare rejection identically", () => {
    expect(describeSandboxFailure({ reason: "REPLAY_DIVERGED", diagnostics: [] })).toBe(
      "REPLAY_DIVERGED",
    );
    expect(
      describeSandboxFailure({ reason: "REPLAY_DIVERGED", diagnostics: ["hash mismatch"] }),
    ).toBe("REPLAY_DIVERGED — hash mismatch");
  });
});
