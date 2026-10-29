import { systemDelayedScheduler, type DelayedScheduler } from "./scheduler.js";

export const UNRESPONSIVE_REPROMPT_DELAY_MS = 30_000;

export type RecoveryScheduler = DelayedScheduler;

export const systemRecoveryScheduler = systemDelayedScheduler;

export interface UnresponsiveWindow {
  isDestroyed(): boolean;
  on(event: "unresponsive" | "responsive", listener: () => void): void;
  removeListener?(event: "unresponsive" | "responsive", listener: () => void): void;
  readonly webContents: {
    isDestroyed(): boolean;
  };
}

export interface RecoveryMessageBoxOptions {
  readonly type: "warning";
  readonly title: string;
  readonly message: string;
  readonly detail: string;
  readonly buttons: readonly string[];
  readonly defaultId: number;
  readonly cancelId: number;
  readonly noLink: true;
}

export interface RecoveryDialog {
  showMessageBox(options: RecoveryMessageBoxOptions): Promise<{ readonly response: number }>;
  showErrorBox(title: string, content: string): void;
}

export interface StackSampler {
  start(): void;
  stop(): readonly string[];
  snapshot(): readonly string[];
}

export interface UnresponsiveRecoveryOptions {
  readonly window: UnresponsiveWindow;
  readonly dialog: RecoveryDialog;
  readonly sampler: StackSampler;
  readonly log: (message: string) => void;
  readonly exportSupportBundle: () => Promise<string | null>;
  readonly quit: () => void;
  readonly rePromptDelayMs?: number;
  readonly scheduler?: RecoveryScheduler;
}

export interface UnresponsiveRecovery {
  dispose(): void;
}

const KEEP_WAITING = 0;
const EXPORT_BUNDLE = 1;
const QUIT = 2;

export function installUnresponsiveRecovery(
  options: UnresponsiveRecoveryOptions,
): UnresponsiveRecovery {
  const { window, dialog, sampler, log, exportSupportBundle, quit } = options;
  const scheduler = options.scheduler ?? systemRecoveryScheduler;
  const rePromptDelayMs = options.rePromptDelayMs ?? UNRESPONSIVE_REPROMPT_DELAY_MS;

  let hung = false;
  let disposed = false;
  let promptOpen = false;
  let rePrompt: unknown | undefined;

  const clearRePrompt = (): void => {
    if (rePrompt === undefined) return;
    scheduler.clearTimeout(rePrompt);
    rePrompt = undefined;
  };

  const schedulePrompt = (): void => {
    clearRePrompt();
    if (disposed || !hung) return;
    rePrompt = scheduler.setTimeout(() => {
      rePrompt = undefined;
      if (disposed || !hung) return;
      void raisePrompt();
    }, rePromptDelayMs);
  };

  const showBundleResult = (path: string | null): void => {
    if (path === null) {
      dialog.showErrorBox("Bluewave", "The support bundle could not be saved.");
      return;
    }
    dialog.showErrorBox("Bluewave", `A support bundle was saved to:\n${path}`);
  };

  const raisePrompt = async (): Promise<void> => {
    if (disposed || !hung || promptOpen) return;
    promptOpen = true;
    const result = await dialog.showMessageBox({
      type: "warning",
      title: "Bluewave is not responding",
      message: "The window has stopped responding.",
      detail:
        "You can keep waiting, export a support bundle describing where the window stalled, or quit.",
      buttons: ["Keep waiting", "Export support bundle", "Quit"],
      defaultId: KEEP_WAITING,
      cancelId: KEEP_WAITING,
      noLink: true,
    });
    promptOpen = false;
    if (disposed || !hung) return;
    if (result.response === QUIT) {
      quit();
      return;
    }
    if (result.response === EXPORT_BUNDLE) {
      const path = await exportSupportBundle().catch(() => null);
      showBundleResult(path);
    }
    schedulePrompt();
  };

  const onUnresponsive = (): void => {
    if (disposed || hung || window.isDestroyed() || window.webContents.isDestroyed()) return;
    hung = true;
    log("[shell] window unresponsive; sampling stacks instead of reloading");
    sampler.start();
    void raisePrompt();
  };

  const onResponsive = (): void => {
    if (!hung) return;
    hung = false;
    clearRePrompt();
    const samples = sampler.stop();
    for (const sample of samples) log(sample);
    log(`[shell] window responsive; flushed ${String(samples.length)} stack sample(s)`);
  };

  window.on("unresponsive", onUnresponsive);
  window.on("responsive", onResponsive);

  return {
    dispose: () => {
      disposed = true;
      clearRePrompt();
      if (hung) sampler.stop();
      window.removeListener?.("unresponsive", onUnresponsive);
      window.removeListener?.("responsive", onResponsive);
    },
  };
}
