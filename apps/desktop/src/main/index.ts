import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { Effect, ManagedRuntime } from "effect";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ipcEvents } from "../shared/ipc-contract.js";
import { installContentSecurityPolicy } from "./csp.js";
import { guardIpc, installShellGuards, type ShellTrust } from "./shellGuards.js";
import { commandHandlers, createCampaignCommandDispatcher } from "./campaignBridge.js";
import { ContentArtifactError, loadContentArtifact } from "./contentArtifact.js";
import { createDesktopWindow } from "./desktopWindow.js";
import { attachDevToolsPageHook } from "./devToolsHook.js";
import { createIpcHandlers, registerIpcChannels, type GuardedIpcMain } from "./ipc.js";
import { createPreferencesBridge } from "./preferences/preferencesBridge.js";
import { installQuitHandshake, type QuitHandshake } from "./quitHandshake.js";
import { reportRendererCrash } from "./rendererCrash.js";
import { installRendererFailureRecovery } from "./rendererFailureRecovery.js";
import { createRendererStackSampler } from "./rendererStackSampler.js";
import { CrashReporter } from "./runtime/crashReporter.js";
import { desktopMainLayer, type CommandEnv } from "./runtime/desktopMainLayer.js";
import { installUnresponsiveRecovery } from "./unresponsiveRecovery.js";
import { isDebugModeEnabled } from "./debugGate.js";
import { withModernExtensionApi } from "./extensionSession.js";

const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");

const reactDevToolsRequested =
  isDebugModeEnabled() || process.env.VITE_BLUEWAVE_DEVTOOLS === "true";

const DEV_SERVER_ORIGIN = "http://localhost:5173";

const RENDERER_ENTRY = resolve(import.meta.dirname, "../renderer/index.html");
const PRELOAD_ENTRY = resolve(import.meta.dirname, "../preload/index.cjs");

const shellTrust: ShellTrust = {
  entryUrl: pathToFileURL(RENDERER_ENTRY).href,
  devOrigin: isDev ? DEV_SERVER_ORIGIN : null,
};

type DesktopMainRuntime = ManagedRuntime.ManagedRuntime<CommandEnv, never>;

let quitHandshake: QuitHandshake | undefined;
let quitting = false;

const log = (message: string): void => console.warn(message);

function requestQuit(): void {
  quitting = true;
  if (quitHandshake !== undefined) {
    quitHandshake.forceQuit();
    return;
  }
  app.quit();
}

function hardFail(message: string): void {
  dialog.showErrorBox("Bluewave", message);
  requestQuit();
}

function exportUnresponsiveBundle(
  runtime: DesktopMainRuntime,
  samples: readonly string[],
): Promise<string | null> {
  return runtime.runPromise(
    Effect.gen(function* () {
      const crash = yield* CrashReporter;
      return yield* crash.capture("renderer", "window-error", {
        message: "Window unresponsive",
        ...(samples.length === 0 ? {} : { stack: samples.join("\n\n") }),
      });
    }).pipe(Effect.catchTag("CommandFailed", () => Effect.succeed(null))),
  );
}

function createWindow(runtime: DesktopMainRuntime): BrowserWindow {
  const win = createDesktopWindow(PRELOAD_ENTRY);
  const sampler = createRendererStackSampler({ target: win.webContents, log });

  installRendererFailureRecovery({
    window: win,
    isDev,
    isQuitting: () => quitting || (quitHandshake?.isQuitting() ?? false),
    onFatal: hardFail,
    onDevServerUnavailable: requestQuit,
    log,
  });

  installUnresponsiveRecovery({
    window: win,
    dialog: {
      showMessageBox: (options) =>
        dialog.showMessageBox({ ...options, buttons: [...options.buttons] }),
      showErrorBox: (title, content) => dialog.showErrorBox(title, content),
    },
    sampler,
    log,
    exportSupportBundle: () => exportUnresponsiveBundle(runtime, sampler.snapshot()),
    quit: requestQuit,
  });

  win.on("maximize", () => win.webContents.send(ipcEvents.windowStateChanged.channel));
  win.on("unmaximize", () => win.webContents.send(ipcEvents.windowStateChanged.channel));

  if (isDev) {
    void win.loadURL(DEV_SERVER_ORIGIN);
    win.webContents.openDevTools();
    if (reactDevToolsRequested) attachDevToolsPageHook(win, log);
  } else {
    void win.loadFile(RENDERER_ENTRY);
  }

  return win;
}

function registerIpc(
  runtime: DesktopMainRuntime,
  ipc: GuardedIpcMain,
  handshake: QuitHandshake,
): void {
  const handlers = createIpcHandlers({
    host: {
      platform: process.platform,
      windowOf: (event) => BrowserWindow.fromWebContents(event.sender),
    },
    dispatchCampaignCommand: createCampaignCommandDispatcher(commandHandlers, () => runtime),
    preferences: createPreferencesBridge(() => runtime),
    reportCrash: (report) => {
      void runtime.runPromise(reportRendererCrash(report));
    },
    quitFlushComplete: () => handshake.complete(),
  });
  registerIpcChannels(ipc, handlers);
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
          requestQuit();
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

    installShellGuards({ app, session: session.defaultSession, trust: shellTrust });
    installContentSecurityPolicy(session.defaultSession, isDev);
    quitHandshake = installQuitHandshake({
      app,
      runtime,
      windows: () => BrowserWindow.getAllWindows(),
      sendFlush: (window) => window.webContents.send(ipcEvents.quitFlush.channel),
      log,
    });
    registerIpc(runtime, guardIpc(ipcMain, shellTrust), quitHandshake);

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

    createWindow(runtime);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(runtime);
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
