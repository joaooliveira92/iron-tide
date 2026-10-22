import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { Effect, ManagedRuntime } from "effect";
import { resolve } from "node:path";
import { applyContentSecurityPolicy } from "./csp.js";
import { commandHandlers, createCampaignCommandDispatcher } from "./campaignBridge.js";
import { ContentArtifactError, loadContentArtifact } from "./contentArtifact.js";
import { createPreferencesBridge } from "./preferences/preferencesBridge.js";
import { CrashReporter } from "./runtime/crashReporter.js";
import { desktopMainLayer, type CommandEnv } from "./runtime/desktopMainLayer.js";
import { isDebugModeEnabled } from "./debugGate.js";
import { withModernExtensionApi } from "./extensionSession.js";
import {
  canRecoverRenderer,
  isActionableLoadFailure,
  MAX_RENDERER_RECOVERIES,
  shouldReloadForDevToolsHook,
} from "./shellPolicy.js";

const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");

const reactDevToolsRequested =
  isDebugModeEnabled() || process.env.VITE_BLUEWAVE_DEVTOOLS === "true";

const QUIT_FLUSH_TIMEOUT_MS = 1_500;

let quitting = false;

function hardFail(message: string): void {
  dialog.showErrorBox("Bluewave", message);
  quitting = true;
  app.quit();
}

function attachFailureRecovery(win: BrowserWindow): void {
  let recoveries = 0;

  const recover = (label: string): void => {
    if (quitting || win.isDestroyed()) return;
    if (!canRecoverRenderer(recoveries)) {
      hardFail(`The window could not recover (${label}).`);
      return;
    }
    recoveries += 1;
    console.warn(`[shell] ${label}; reloading (${recoveries}/${MAX_RENDERER_RECOVERIES})`);
    win.reload();
  };

  win.webContents.on("render-process-gone", (_event, details) => {
    recover(`renderer process gone (${details.reason})`);
  });
  win.on("unresponsive", () => {
    recover("window unresponsive");
  });
  win.on("responsive", () => {
    recoveries = 0;
  });
  win.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (!isActionableLoadFailure(code, isMainFrame)) return;
    if (isDev) {
      console.warn(`[shell] dev server unavailable (${description}); quitting`);
      quitting = true;
      app.quit();
      return;
    }
    recover(`failed to load ${url} (${description}, ${code})`);
  });
}

function attachDevToolsPageHook(win: BrowserWindow): void {
  let reloaded = false;
  win.webContents.on("did-finish-load", () => {
    if (reloaded) return;
    void win.webContents
      .executeJavaScript(
        "window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers?.size : -1",
      )
      .then((rendererCount: unknown) => {
        if (
          typeof rendererCount === "number" &&
          shouldReloadForDevToolsHook(rendererCount, reloaded)
        ) {
          reloaded = true;
          console.log("[shell] React DevTools hook not attached yet; reloading once");
          win.webContents.reload();
        }
      })
      .catch(() => undefined);
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    webPreferences: {
      preload: resolve(import.meta.dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: applyContentSecurityPolicy(details.responseHeaders, isDev),
    });
  });

  attachFailureRecovery(win);

  win.on("maximize", () => win.webContents.send("window:state-changed"));
  win.on("unmaximize", () => win.webContents.send("window:state-changed"));

  if (isDev) {
    void win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
    if (reactDevToolsRequested) attachDevToolsPageHook(win);
  } else {
    void win.loadFile(resolve(import.meta.dirname, "../renderer/index.html"));
  }

  return win;
}

type DesktopMainRuntime = ManagedRuntime.ManagedRuntime<CommandEnv, never>;

function registerIpc(runtime: DesktopMainRuntime): void {
  const dispatchCampaignCommand = createCampaignCommandDispatcher(commandHandlers, () => runtime);
  ipcMain.handle("campaign:execute", (_event, command: string, payload: unknown) =>
    dispatchCampaignCommand(command, payload),
  );

  const preferences = createPreferencesBridge(() => runtime);
  ipcMain.handle("preferences:read", () => preferences.read());
  ipcMain.handle("preferences:write", (_event, payload: unknown) => preferences.write(payload));
  ipcMain.handle("preferences:read-campaign", (_event, sessionId: string) =>
    preferences.readCampaign(sessionId),
  );
  ipcMain.handle("preferences:write-campaign", (_event, sessionId: string, payload: unknown) =>
    preferences.writeCampaign(sessionId, payload),
  );

  ipcMain.on("support:report-crash", (_event, payload: unknown) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const crash = yield* CrashReporter;
        const parsed = yield* crash.parseRendererInput(payload);
        if (parsed === null) return;
        yield* crash.capture("renderer", parsed.kind, {
          message: parsed.message,
          stack: parsed.stack,
        });
      }).pipe(Effect.catchTag("CommandFailed", () => Effect.void)),
    );
  });

  ipcMain.handle("window:get-state", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return {
      platform: process.platform,
      isMaximized: win?.isMaximized() ?? false,
      maximizable: win?.isMaximizable() ?? true,
      minimizable: win?.isMinimizable() ?? true,
    };
  });
  ipcMain.on("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on("window:maximize-toggle", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win === null) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

function installBoundedShutdown(runtime: DesktopMainRuntime): void {
  app.on("before-quit", (event) => {
    if (quitting) return;
    const win = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
    if (win === undefined || win.webContents.isDestroyed()) return;

    event.preventDefault();
    quitting = true;

    let settled = false;
    const proceed = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ipcMain.removeListener("app:quit-flush-complete", proceed);
      void runtime.dispose().then(
        () => app.quit(),
        () => app.quit(),
      );
    };
    const timer = setTimeout(proceed, QUIT_FLUSH_TIMEOUT_MS);
    timer.unref?.();
    ipcMain.once("app:quit-flush-complete", proceed);
    win.webContents.send("app:quit-flush");
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win === undefined) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  void app.whenReady().then(async () => {
    const runtime = ManagedRuntime.make(desktopMainLayer());

    await runtime.runPromise(
      Effect.gen(function* () {
        const crash = yield* CrashReporter;
        yield* crash.installProcessHandlers((error, bundlePath) => {
          console.error("[crash] uncaught error:", error);
          dialog.showErrorBox(
            "Bluewave",
            "Bluewave hit an unexpected error and needs to close." +
              (bundlePath !== null ? `\n\nA support bundle was saved to:\n${bundlePath}` : ""),
          );
          quitting = true;
          app.quit();
        });
      }),
    );

    if (isDev && reactDevToolsRequested) {
      try {
        const { installExtension, REACT_DEVELOPER_TOOLS } =
          await import("electron-devtools-installer");
        const { name } = await installExtension(REACT_DEVELOPER_TOOLS, {
          session: withModernExtensionApi(session.defaultSession),
        });
        console.log(`Added extension: ${name}`);
      } catch (error) {
        console.warn("Failed to install React DevTools extension:", error);
      }
    }

    registerIpc(runtime);
    installBoundedShutdown(runtime);

    try {
      loadContentArtifact();
    } catch (error) {
      const message = ContentArtifactError.is(error)
        ? error.message
        : `The compiled content artifact could not be verified: ${
            error instanceof Error ? error.message : String(error)
          }`;
      hardFail(message);
      return;
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => app.quit());
  }
}
