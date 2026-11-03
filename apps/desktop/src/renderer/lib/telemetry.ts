/// <reference types="vite-plus/client" />

import { createLogStore, isRecord, type LogStore } from "./versioned-log-store.js";

export interface WideTelemetryEvent {
  readonly action: string;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly duration_ms: number;
  readonly outcome: "success" | "rejected";
  readonly diagnostics: readonly string[];
  readonly payload?: Record<string, unknown>;
}

export const STORAGE_KEY = "bluewave-telemetry-logs";
const MAX_LOGS = 100;
const MAX_LOG_CHARS = 100_000;

function isWideTelemetryEvent(value: unknown): value is WideTelemetryEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.action === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.duration_ms === "number" &&
    (value.outcome === "success" || value.outcome === "rejected") &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every((diagnostic) => typeof diagnostic === "string") &&
    (value.payload === undefined || isRecord(value.payload))
  );
}

const logStore: LogStore<WideTelemetryEvent> = createLogStore<WideTelemetryEvent>({
  storageKey: STORAGE_KEY,
  maxEntries: MAX_LOGS,
  maxChars: MAX_LOG_CHARS,
  isEntry: isWideTelemetryEvent,
});

export function emitWideEvent(
  action: string,
  sessionId: string,
  duration_ms: number,
  outcome: "success" | "rejected",
  diagnostics: readonly string[] = [],
  payload?: Record<string, unknown>,
): WideTelemetryEvent {
  const event: WideTelemetryEvent = {
    action,
    timestamp: new Date().toISOString(),
    sessionId,
    duration_ms,
    outcome,
    diagnostics,
    ...(payload !== undefined ? { payload } : {}),
  };
  logStore.prepend(event);
  if (import.meta.env.DEV) console.debug("[WIDE_EVENT]", event);
  return event;
}

export function getRecordedWideEvents(): readonly WideTelemetryEvent[] {
  return logStore.entries();
}

export function clearWideEvents(): void {
  logStore.clear();
}
