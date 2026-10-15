/// <reference types="vite-plus/client" />
/**
 * Wide Event Telemetry Utility following Wide Event principles.
 * Emits exactly one canonical, structured wide event per key user/system action,
 * with correlated session/campaign IDs and diagnostics.
 */

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
let cachedLogs: WideTelemetryEvent[] | null = null;
let persistenceScheduled = false;
function readLogs(): WideTelemetryEvent[] {
  if (cachedLogs !== null) return cachedLogs;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cachedLogs = raw ? (JSON.parse(raw) as WideTelemetryEvent[]) : [];
  } catch {
    cachedLogs = [];
  }
  return cachedLogs;
}
function schedulePersistence(): void {
  if (persistenceScheduled) return;
  persistenceScheduled = true;
  const persist = () => {
    persistenceScheduled = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedLogs ?? []));
    } catch (error) {
      console.error("Failed to save telemetry event", error);
    }
  };
  const requestIdleCallback = (window as Partial<typeof window>).requestIdleCallback;
  if (requestIdleCallback) requestIdleCallback(persist);
  else window.setTimeout(persist, 0);
}
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
  const logs = readLogs();
  logs.unshift(event);
  cachedLogs = logs.slice(0, MAX_LOGS);
  schedulePersistence();
  if (import.meta.env.DEV) console.debug("[WIDE_EVENT]", event);
  return event;
}
