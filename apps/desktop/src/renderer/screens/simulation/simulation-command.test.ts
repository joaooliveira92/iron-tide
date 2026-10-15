import { describe, expect, it } from "vite-plus/test";

import type { BridgeResult } from "../../../shared/bridge-contract.js";
import {
  commandFailureMessage,
  runSimulationCommand,
  type SimulationCommandEvent,
  type SimulationTelemetryPort,
} from "./simulation-command.js";

function recordingTelemetry(): {
  readonly telemetry: SimulationTelemetryPort;
  readonly events: SimulationCommandEvent[];
  readonly audits: string[];
} {
  const events: SimulationCommandEvent[] = [];
  const audits: string[] = [];
  return {
    telemetry: {
      emit: (event) => events.push(event),
      audit: (action) => audits.push(action),
    },
    events,
    audits,
  };
}

const base = {
  action: "month_commit",
  sessionId: "ses_1",
  transportErrorFallback: "fallback message",
} as const;

describe("runSimulationCommand", () => {
  it("returns the value and emits exactly one success event, recording the audit", async () => {
    const { telemetry, events, audits } = recordingTelemetry();

    const result = await runSimulationCommand<number>({
      ...base,
      telemetry,
      run: async (): Promise<BridgeResult<number>> => ({
        outcome: "success",
        value: 42,
        diagnostics: [],
      }),
      audit: () => ({ randomDecisions: [], domainEvents: [], financialLedger: [] }),
    });

    expect(result).toEqual({ status: "success", value: 42 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "month_commit",
      sessionId: "ses_1",
      outcome: "success",
      diagnostics: [],
    });
    expect(audits).toEqual(["month_commit"]);
  });

  it("maps a rejected bridge result and emits the reason as the diagnostic", async () => {
    const { telemetry, events, audits } = recordingTelemetry();

    const result = await runSimulationCommand<number>({
      ...base,
      telemetry,
      run: async (): Promise<BridgeResult<number>> => ({
        outcome: "rejected",
        reason: "REVISION_MISMATCH",
        diagnostics: ["stale"],
        currentRevision: 9,
      }),
    });

    expect(result).toEqual({
      status: "rejected",
      reason: "REVISION_MISMATCH",
      diagnostics: ["stale"],
    });
    expect(events[0]?.diagnostics).toEqual(["REVISION_MISMATCH"]);
    expect(audits).toEqual([]);
  });

  it("distinguishes an engine error from a rejection", async () => {
    const { telemetry } = recordingTelemetry();

    const result = await runSimulationCommand<number>({
      ...base,
      telemetry,
      run: async (): Promise<BridgeResult<number>> => ({
        outcome: "error",
        reason: "ENGINE_FAULT",
        diagnostics: ["core dumped"],
      }),
    });

    expect(result).toEqual({
      status: "engine-error",
      reason: "ENGINE_FAULT",
      diagnostics: ["core dumped"],
    });
  });

  it("captures a thrown transport error using the error's message", async () => {
    const { telemetry, events } = recordingTelemetry();

    const result = await runSimulationCommand<number>({
      ...base,
      telemetry,
      run: async () => {
        throw new Error("network down");
      },
    });

    expect(result).toEqual({ status: "transport-error", message: "network down" });
    expect(events[0]?.outcome).toBe("rejected");
    expect(events[0]?.diagnostics).toEqual(["network down"]);
  });

  it("falls back to the provided message for a non-Error throw", async () => {
    const { telemetry } = recordingTelemetry();

    const result = await runSimulationCommand<number>({
      ...base,
      telemetry,
      run: async () => {
        throw "not an error";
      },
    });

    expect(result).toEqual({ status: "transport-error", message: "fallback message" });
  });
});

describe("commandFailureMessage", () => {
  it("appends diagnostics by default", () => {
    expect(
      commandFailureMessage(
        { status: "rejected", reason: "NOPE", diagnostics: ["a", "b"] },
        "Failed to advance turn",
      ),
    ).toBe("Failed to advance turn: NOPE. a; b");
  });

  it("omits diagnostics when asked (resolve-style errors)", () => {
    expect(
      commandFailureMessage(
        { status: "rejected", reason: "NOPE", diagnostics: ["a"] },
        "Failed to resolve",
        { includeDiagnostics: false },
      ),
    ).toBe("Failed to resolve: NOPE.");
  });

  it("returns the raw transport message untouched", () => {
    expect(
      commandFailureMessage({ status: "transport-error", message: "socket closed" }, "Failed"),
    ).toBe("socket closed");
  });
});
