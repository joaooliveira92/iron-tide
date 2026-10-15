/**
 * Renderer-side crash capture (release-readiness ticket 02, ADR-0133). Installs
 * `error` / `unhandledrejection` listeners that log the failure (never swallow
 * it) and forward a small payload to the main process, which writes the
 * local-only support bundle. Nothing is sent over the network.
 */
import type { BluewaveDesktopBridge } from "../../preload/index.js";

type ReportCrash = NonNullable<BluewaveDesktopBridge["reportCrash"]>;
type RendererCrashPayload = Parameters<ReportCrash>[0];
/** Only the slice of the bridge the capture path uses; a fake is easy in tests. */
export type CrashBridge = { reportCrash?: ReportCrash };
/** The slice of `window` the installer needs, so a fake target is easy in tests. */
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

/** Log and forward a renderer error (`window` `error` event). */
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

/** Log and forward an unhandled promise rejection. */
export function reportRendererRejection(reason: unknown, bridge: CrashBridge | undefined): void {
  const details = detailsOf(reason);
  console.error("[renderer] unhandled rejection:", reason);
  bridge?.reportCrash?.({ kind: "unhandledrejection", ...details } satisfies RendererCrashPayload);
}

/**
 * Install the renderer crash listeners. `bridge` defaults to `window.bluewave`
 * and `target` to `window`; both are injectable so the wiring is unit-tested
 * without a real DOM. A missing bridge (tests, embedding) still logs.
 */
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
