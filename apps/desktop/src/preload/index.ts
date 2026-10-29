import { contextBridge, ipcRenderer } from "electron";
import type {
  CampaignCommandClient,
  CampaignCommandMap,
  CampaignCommandName,
} from "../shared/campaign-contract.js";
import type { AppStartupSnapshot, BridgeResult, WindowState } from "../shared/bridge-contract.js";
import {
  ipcEvents,
  ipcMessages,
  ipcRequests,
  type IpcArguments,
  type IpcMessage,
  type IpcRequest,
  type RendererCrashReport,
} from "../shared/ipc-contract.js";
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
  readStartupSnapshot?(): Promise<BridgeResult<AppStartupSnapshot>>;
  getWindowState(): Promise<WindowState>;
  windowMinimize(): void;
  windowMaximizeToggle(): void;
  windowClose(): void;
  onQuitFlush?(handler: () => void): void;
  notifyQuitFlushComplete?(): void;
  reportCrash?(report: RendererCrashReport): void;
}

declare global {
  interface Window {
    bluewave?: BluewaveDesktopBridge;
  }
}

function invoke<Arguments extends IpcArguments, Result>(
  request: IpcRequest<Arguments, Result>,
  ...args: Arguments
): Promise<Result> {
  return ipcRenderer.invoke(request.channel, ...args);
}

function send<Arguments extends IpcArguments>(
  message: IpcMessage<Arguments>,
  ...args: Arguments
): void {
  ipcRenderer.send(message.channel, ...args);
}

function executeCampaign<Name extends CampaignCommandName>(
  command: Name,
  payload: CampaignCommandMap[Name]["payload"],
): Promise<BridgeResult<CampaignCommandMap[Name]["result"]>> {
  return invoke(ipcRequests.campaignExecute, command, payload) as Promise<
    BridgeResult<CampaignCommandMap[Name]["result"]>
  >;
}

const startupSnapshot = invoke(ipcRequests.appReadStartup);
void startupSnapshot.catch(() => undefined);

contextBridge.exposeInMainWorld("bluewave", {
  campaign: {
    execute: executeCampaign,
  },
  preferences: {
    read: () => invoke(ipcRequests.preferencesRead),
    write: (request: WriteAppPreferencesRequest) => invoke(ipcRequests.preferencesWrite, request),
    readCampaign: (sessionId: string) => invoke(ipcRequests.preferencesReadCampaign, sessionId),
    writeCampaign: (sessionId: string, request: WriteCampaignPreferencesRequest) =>
      invoke(ipcRequests.preferencesWriteCampaign, sessionId, request),
  },
  platform: process.platform,
  readStartupSnapshot: () => startupSnapshot,
  getWindowState: () => invoke(ipcRequests.windowGetState),
  windowMinimize: () => send(ipcMessages.windowMinimize),
  windowMaximizeToggle: () => send(ipcMessages.windowMaximizeToggle),
  windowClose: () => send(ipcMessages.windowClose),
  onQuitFlush: (handler: () => void) => {
    ipcRenderer.on(ipcEvents.quitFlush.channel, () => handler());
  },
  notifyQuitFlushComplete: () => {
    send(ipcMessages.quitFlushComplete);
  },
  reportCrash: (report) => {
    send(ipcMessages.reportCrash, report);
  },
} satisfies BluewaveDesktopBridge);
