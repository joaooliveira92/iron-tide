import type { BluewaveDesktopBridge } from "../../preload/index.js";

type ReportCrash = NonNullable<BluewaveDesktopBridge["reportCrash"]>;
type RendererCrashPayload = Parameters<ReportCrash>[0];
export type CrashBridge = { reportCrash?: ReportCrash };
export interface CrashListenerTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
}

function detailsOf(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return reason.stack !== undefined
      ? { message: reason.message, stack: reason.stack }
      : { message: reason.message };
  }
  if (typeof reason === "string") return { message: reason };
  try {
    return { message: JSON.stringify(reason) ?? String(reason) };
  } catch {
    return { message: String(reason) };
  }
}

export function reportRendererError(
  error: unknown,
  fallbackMessage: string,
  bridge: CrashBridge | undefined,
): void {
  const details =
    error !== undefined && error !== null ? detailsOf(error) : { message: fallbackMessage };
  console.error("[renderer] unhandled error:", error ?? details.message);
  bridge?.reportCrash?.({ kind: "window-error", ...details } satisfies RendererCrashPayload);
}

export function reportRendererRejection(reason: unknown, bridge: CrashBridge | undefined): void {
  const details = detailsOf(reason);
  console.error("[renderer] unhandled rejection:", reason);
  bridge?.reportCrash?.({ kind: "unhandledrejection", ...details } satisfies RendererCrashPayload);
}

export function installRendererCrashHandlers(
  bridge: CrashBridge | undefined = window.bluewave,
  target: CrashListenerTarget = window,
): void {
  target.addEventListener("error", (event) => {
    const { error, message } = event as ErrorEvent;
    reportRendererError(error, message, bridge);
  });
  target.addEventListener("unhandledrejection", (event) => {
    const { reason } = event as PromiseRejectionEvent;
    reportRendererRejection(reason, bridge);
  });
}
