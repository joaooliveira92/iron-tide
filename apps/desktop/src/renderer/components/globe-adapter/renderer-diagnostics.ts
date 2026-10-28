import type { OverviewRenderer } from "./globe-adapter-flag.js";

export type RendererDiagnosticEvent = "started" | "fallback";

export interface RendererDiagnostic {
  readonly renderer: OverviewRenderer;
  readonly event: RendererDiagnosticEvent;
  readonly reason?: string;
}

export interface RendererDiagnosticSink {
  readonly push: (diagnostic: RendererDiagnostic) => void;
}

declare global {
  interface Window {
    __bluewaveRendererDiagnostics?: RendererDiagnostic[];
  }
}

const MAX_DIAGNOSTICS = 20;

export function recordRendererDiagnostic(diagnostic: RendererDiagnostic): void {
  if (typeof window !== "undefined") {
    const existing = window.__bluewaveRendererDiagnostics ?? [];
    window.__bluewaveRendererDiagnostics = [...existing, diagnostic].slice(-MAX_DIAGNOSTICS);
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.overviewRenderer = diagnostic.renderer;
    if (diagnostic.event === "fallback") {
      document.documentElement.dataset.overviewRendererFallback = diagnostic.reason ?? "unknown";
    } else {
      delete document.documentElement.dataset.overviewRendererFallback;
    }
  }
  if (diagnostic.event === "fallback") {
    console.warn("[overview] renderer fallback", diagnostic);
  } else {
    console.info("[overview] renderer started", diagnostic);
  }
}
