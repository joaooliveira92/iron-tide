import { contextBridge, ipcRenderer } from "electron";
import type { CampaignCommandClient } from "../shared/campaign-command-contract.js";
import type { BridgeResult, WindowState } from "../shared/bridge-contract.js";
import type {
  PreferencesSnapshot,
  WriteAppPreferencesRequest,
} from "../shared/preferences-contract.js";

/**
 * The desktop app's IPC bridge, exposed on `window.bluewave`. Grounded in
 * every screen's actual import path (`../../preload/index.js`) — see the
 * desktop-mvp map, tickets 07/11. `campaign.execute` dispatches every
 * command in `CAMPAIGN_COMMAND_NAMES` (see
 * `shared/campaign-command-contract.ts` — the single source of truth for the
 * command name set) through a single
 * `campaign:execute` channel; `src/main/campaignBridge.ts` owns the
 * per-command implementations. Window-chrome methods back the shell's custom,
 * frameless-window titlebar (`WindowContext.tsx`).
 */
export interface BluewaveDesktopBridge {
  readonly campaign: CampaignCommandClient;
  /**
   * The dedicated app-scope preferences capability (D6). Separate from the
   * campaign command channel because app-scope preferences exist with no open
   * campaign; every payload is decoded strictly at the main boundary.
   */
  readonly preferences: {
    read(): Promise<BridgeResult<PreferencesSnapshot>>;
    write(request: WriteAppPreferencesRequest): Promise<BridgeResult<PreferencesSnapshot>>;
  };
  readonly platform: NodeJS.Platform;
  getWindowState(): Promise<WindowState>;
  windowMinimize(): void;
  windowMaximizeToggle(): void;
  windowClose(): void;
  /**
   * Registers the renderer's flush handler for the shell's bounded quit
   * handshake (ADR-0121). Optional so test doubles need not implement it; the
   * real preload always provides it.
   */
  onQuitFlush?(handler: () => void): void;
  /** Acknowledges the flush request so a bounded quit may proceed. */
  notifyQuitFlushComplete?(): void;
  /**
   * Forwards a renderer crash to the main process, which writes a local-only
   * support bundle (ADR-0133). Optional so test doubles need not implement it.
   */
  reportCrash?(report: {
    readonly kind: "window-error" | "unhandledrejection";
    readonly message: string;
    readonly stack?: string;
  }): void;
}

declare global {
  interface Window {
    bluewave?: BluewaveDesktopBridge;
  }
}

contextBridge.exposeInMainWorld("bluewave", {
  campaign: {
    execute: (command: string, payload: unknown) => {
      return ipcRenderer.invoke("campaign:execute", command, payload);
    },
  },
  preferences: {
    read: () => ipcRenderer.invoke("preferences:read"),
    write: (request: WriteAppPreferencesRequest) =>
      ipcRenderer.invoke("preferences:write", request),
  },
  platform: process.platform,
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximizeToggle: () => ipcRenderer.send("window:maximize-toggle"),
  windowClose: () => ipcRenderer.send("window:close"),
  onQuitFlush: (handler: () => void) => {
    ipcRenderer.on("app:quit-flush", () => handler());
  },
  notifyQuitFlushComplete: () => {
    ipcRenderer.send("app:quit-flush-complete");
  },
  reportCrash: (report) => {
    ipcRenderer.send("support:report-crash", report);
  },
} satisfies BluewaveDesktopBridge);
