import { systemDelayedScheduler, type DelayedScheduler } from "./scheduler.js";

export const QUIT_FLUSH_TIMEOUT_MS = 1_500;

export interface QuitWindow {
  isDestroyed(): boolean;
  readonly webContents: {
    isDestroyed(): boolean;
    send(channel: string): void;
  };
}

export interface QuitEvent {
  preventDefault(): void;
}

export interface QuitApp {
  on(event: "before-quit", listener: (event: QuitEvent) => void): void;
  removeListener?(event: "before-quit", listener: (event: QuitEvent) => void): void;
  quit(): void;
}

export interface QuitRuntime {
  dispose(): Promise<void>;
}

export interface QuitHandshakeOptions {
  readonly app: QuitApp;
  readonly runtime: QuitRuntime;
  readonly windows: () => readonly QuitWindow[];
  readonly sendFlush: (window: QuitWindow) => void;
  readonly timeoutMs?: number;
  readonly scheduler?: DelayedScheduler;
  readonly log?: (message: string) => void;
}

export interface QuitHandshake {
  complete(): void;
  forceQuit(): void;
  isQuitting(): boolean;
  dispose(): void;
}

function firstLiveWindow(windows: readonly QuitWindow[]): QuitWindow | undefined {
  return windows.find((window) => !window.isDestroyed() && !window.webContents.isDestroyed());
}

export function installQuitHandshake(options: QuitHandshakeOptions): QuitHandshake {
  const { app, runtime, windows, sendFlush } = options;
  const timeoutMs = options.timeoutMs ?? QUIT_FLUSH_TIMEOUT_MS;
  const scheduler = options.scheduler ?? systemDelayedScheduler;
  const log = options.log ?? (() => undefined);

  let quitting = false;
  let finished = false;
  let complete: (() => void) | null = null;
  let timer: unknown | undefined;

  const removeListener = (): void => {
    app.removeListener?.("before-quit", onBeforeQuit);
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    complete = null;
    if (timer !== undefined) {
      scheduler.clearTimeout(timer);
      timer = undefined;
    }
    removeListener();
    void runtime.dispose().then(
      () => app.quit(),
      (error: unknown) => {
        log(`[shell] runtime disposal failed during quit: ${String(error)}`);
        app.quit();
      },
    );
  };

  function onBeforeQuit(event: QuitEvent): void {
    if (finished) return;
    if (quitting) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    quitting = true;
    const window = firstLiveWindow(windows());
    if (window === undefined) {
      finish();
      return;
    }
    complete = finish;
    timer = scheduler.setTimeout(finish, timeoutMs);
    sendFlush(window);
  }

  app.on("before-quit", onBeforeQuit);

  return {
    complete: () => complete?.(),
    forceQuit: () => {
      quitting = true;
      finish();
    },
    isQuitting: () => quitting,
    dispose: () => {
      if (timer !== undefined) scheduler.clearTimeout(timer);
      timer = undefined;
      complete = null;
      removeListener();
    },
  };
}
