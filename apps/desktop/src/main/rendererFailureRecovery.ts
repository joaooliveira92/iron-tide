import {
  canRecoverRenderer,
  isActionableLoadFailure,
  MAX_RENDERER_RECOVERIES,
} from "./shellPolicy.js";

interface ProcessGoneWebContents {
  on(
    event: "render-process-gone",
    listener: (event: unknown, details: { readonly reason: string }) => void,
  ): void;
  on(
    event: "did-fail-load",
    listener: (
      event: unknown,
      code: number,
      description: string,
      url: string,
      isMainFrame: boolean,
    ) => void,
  ): void;
}

export interface FailureRecoveryWindow {
  isDestroyed(): boolean;
  reload(): void;
  readonly webContents: ProcessGoneWebContents;
  on(event: "responsive", listener: () => void): void;
}

export interface RendererFailureRecoveryOptions {
  readonly window: FailureRecoveryWindow;
  readonly isDev: boolean;
  readonly isQuitting: () => boolean;
  readonly onFatal: (message: string) => void;
  readonly onDevServerUnavailable: (description: string) => void;
  readonly log: (message: string) => void;
  readonly maxRecoveries?: number;
}

export interface RendererFailureRecovery {
  readonly recoveries: () => number;
}

export function installRendererFailureRecovery(
  options: RendererFailureRecoveryOptions,
): RendererFailureRecovery {
  const { window, isDev, isQuitting, onFatal, onDevServerUnavailable, log } = options;
  const max = options.maxRecoveries ?? MAX_RENDERER_RECOVERIES;
  let recoveries = 0;

  const recover = (label: string): void => {
    if (isQuitting() || window.isDestroyed()) return;
    if (!canRecoverRenderer(recoveries, max)) {
      onFatal(`The window could not recover (${label}).`);
      return;
    }
    recoveries += 1;
    log(`[shell] ${label}; reloading (${String(recoveries)}/${String(max)})`);
    window.reload();
  };

  window.webContents.on("render-process-gone", (_event, details) => {
    recover(`renderer process gone (${details.reason})`);
  });
  window.on("responsive", () => {
    recoveries = 0;
  });
  window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (!isActionableLoadFailure(code, isMainFrame)) return;
    if (isDev) {
      log(`[shell] dev server unavailable (${description}); quitting`);
      onDevServerUnavailable(description);
      return;
    }
    recover(`failed to load ${url} (${description}, ${String(code)})`);
  });

  return { recoveries: () => recoveries };
}
