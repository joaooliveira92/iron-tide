import type { EngineAuditInput } from "@bluewave/campaign-engine";

import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { recordEngineAudit } from "../../lib/engine-audit.js";
import { emitWideEvent } from "../../lib/telemetry.js";

export interface SimulationCommandEvent {
  readonly action: string;
  readonly sessionId: string;
  readonly durationMs: number;
  readonly outcome: "success" | "rejected";
  readonly diagnostics: readonly string[];
}

export interface SimulationTelemetryPort {
  emit(event: SimulationCommandEvent): void;
  audit(action: string, input: EngineAuditInput): void;
}

export type SimulationCommandResult<Value> =
  | { readonly status: "success"; readonly value: Value }
  | {
      readonly status: "rejected";
      readonly reason: string;
      readonly diagnostics: readonly string[];
    }
  | {
      readonly status: "engine-error";
      readonly reason: string;
      readonly diagnostics: readonly string[];
    }
  | { readonly status: "transport-error"; readonly message: string };

export type SimulationCommandFailure = Exclude<
  SimulationCommandResult<unknown>,
  { readonly status: "success" }
>;

export interface RunSimulationCommandOptions<Value> {
  readonly action: string;
  readonly sessionId: string;
  readonly telemetry: SimulationTelemetryPort;
  readonly run: () => Promise<BridgeResult<Value>>;
  readonly audit?: (value: Value) => EngineAuditInput;
  readonly transportErrorFallback: string;
}

export async function runSimulationCommand<Value>(
  options: RunSimulationCommandOptions<Value>,
): Promise<SimulationCommandResult<Value>> {
  const startedAt = performance.now();
  try {
    const result = await options.run();
    const durationMs = Math.round(performance.now() - startedAt);

    if (result.outcome === "success") {
      options.telemetry.emit({
        action: options.action,
        sessionId: options.sessionId,
        durationMs,
        outcome: "success",
        diagnostics: [],
      });
      if (options.audit !== undefined) {
        options.telemetry.audit(options.action, options.audit(result.value));
      }
      return { status: "success", value: result.value };
    }

    options.telemetry.emit({
      action: options.action,
      sessionId: options.sessionId,
      durationMs,
      outcome: "rejected",
      diagnostics: [result.reason],
    });
    return result.outcome === "rejected"
      ? { status: "rejected", reason: result.reason, diagnostics: result.diagnostics }
      : { status: "engine-error", reason: result.reason, diagnostics: result.diagnostics };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : options.transportErrorFallback;
    options.telemetry.emit({
      action: options.action,
      sessionId: options.sessionId,
      durationMs,
      outcome: "rejected",
      diagnostics: [message],
    });
    return { status: "transport-error", message };
  }
}

export function commandFailureMessage(
  result: SimulationCommandFailure,
  prefix: string,
  options: { readonly includeDiagnostics?: boolean } = {},
): string {
  if (result.status === "transport-error") return result.message;
  const includeDiagnostics = options.includeDiagnostics ?? true;
  const suffix =
    includeDiagnostics && result.diagnostics.length > 0 ? ` ${result.diagnostics.join("; ")}` : "";
  return `${prefix}: ${result.reason}.${suffix}`;
}

export function createDesktopSimulationTelemetry(): SimulationTelemetryPort {
  return {
    emit: (event) => {
      emitWideEvent(
        event.action,
        event.sessionId,
        event.durationMs,
        event.outcome,
        event.diagnostics,
      );
    },
    audit: (action, input) => {
      recordEngineAudit(action, input);
    },
  };
}
