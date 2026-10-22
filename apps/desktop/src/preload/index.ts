import { contextBridge, ipcRenderer } from "electron";
import type { CampaignCommandClient } from "../shared/campaign-contract.js";
import type { BridgeResult, WindowState } from "../shared/bridge-contract.js";
import type {
  CampaignPreferencesSnapshot,
  PreferencesSnapshot,
  WriteAppPreferencesRequest,
  WriteCampaignPreferencesRequest,
} from "../shared/preferences-contract.js";

export interface BluewaveDesktopBridge {
  readonly campaign: CampaignCommandClient;
  readonly preferences: {
    read(): Promise<BridgeResult<PreferencesSnapshot>>;
    write(request: WriteAppPreferencesRequest): Promise<BridgeResult<PreferencesSnapshot>>;
    readCampaign(sessionId: string): Promise<BridgeResult<CampaignPreferencesSnapshot>>;
    writeCampaign(
      sessionId: string,
      request: WriteCampaignPreferencesRequest,
    ): Promise<BridgeResult<CampaignPreferencesSnapshot>>;
  };
  readonly platform: NodeJS.Platform;
  getWindowState(): Promise<WindowState>;
  windowMinimize(): void;
  windowMaximizeToggle(): void;
  windowClose(): void;
  onQuitFlush?(handler: () => void): void;
  notifyQuitFlushComplete?(): void;
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
    readCampaign: (sessionId: string) => ipcRenderer.invoke("preferences:read-campaign", sessionId),
    writeCampaign: (sessionId: string, request: WriteCampaignPreferencesRequest) =>
      ipcRenderer.invoke("preferences:write-campaign", sessionId, request),
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
