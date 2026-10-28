import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import type { BridgeResult } from "../shared/bridge-contract.js";
import {
  IPC_MESSAGE_NAMES,
  IPC_REQUEST_NAMES,
  ipcMessages,
  ipcRequests,
  type IpcMessageArgs,
  type IpcMessageName,
  type IpcRequestArgs,
  type IpcRequestName,
  type IpcRequestResult,
  type RendererCrashReport,
} from "../shared/ipc-contract.js";
import type { PreferencesBridge } from "./preferences/preferencesBridge.js";
import type { GuardableIpc } from "./shellGuards.js";

export interface IpcWindow {
  isMaximized(): boolean;
  isMaximizable(): boolean;
  isMinimizable(): boolean;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  close(): void;
}

export interface IpcHost {
  readonly platform: NodeJS.Platform;
  windowOf(event: IpcMainInvokeEvent | IpcMainEvent): IpcWindow | null;
}

export interface IpcDependencies {
  readonly host: IpcHost;
  readonly dispatchCampaignCommand: (
    command: string,
    payload: unknown,
  ) => Promise<BridgeResult<unknown>>;
  readonly preferences: PreferencesBridge;
  readonly reportCrash: (report: RendererCrashReport) => void;
  readonly quitFlushComplete: () => void;
}

export type IpcRequestHandlers = {
  readonly [Name in IpcRequestName]: (
    event: IpcMainInvokeEvent,
    ...args: IpcRequestArgs<Name>
  ) => IpcRequestResult<Name> | Promise<IpcRequestResult<Name>>;
};

export type IpcMessageHandlers = {
  readonly [Name in IpcMessageName]: (event: IpcMainEvent, ...args: IpcMessageArgs<Name>) => void;
};

export interface IpcHandlers {
  readonly requests: IpcRequestHandlers;
  readonly messages: IpcMessageHandlers;
}

export function createIpcHandlers(dependencies: IpcDependencies): IpcHandlers {
  const { host } = dependencies;
  return {
    requests: {
      campaignExecute: (_event, command, payload) =>
        dependencies.dispatchCampaignCommand(command, payload),
      preferencesRead: () => dependencies.preferences.read(),
      preferencesWrite: (_event, request) => dependencies.preferences.write(request),
      preferencesReadCampaign: (_event, sessionId) =>
        dependencies.preferences.readCampaign(sessionId),
      preferencesWriteCampaign: (_event, sessionId, request) =>
        dependencies.preferences.writeCampaign(sessionId, request),
      windowGetState: (event) => {
        const window = host.windowOf(event);
        return {
          platform: host.platform,
          isMaximized: window?.isMaximized() ?? false,
          maximizable: window?.isMaximizable() ?? true,
          minimizable: window?.isMinimizable() ?? true,
        };
      },
    },
    messages: {
      windowMinimize: (event) => {
        host.windowOf(event)?.minimize();
      },
      windowMaximizeToggle: (event) => {
        const window = host.windowOf(event);
        if (window === null) return;
        if (window.isMaximized()) window.unmaximize();
        else window.maximize();
      },
      windowClose: (event) => {
        host.windowOf(event)?.close();
      },
      reportCrash: (_event, report) => dependencies.reportCrash(report),
      quitFlushComplete: () => dependencies.quitFlushComplete(),
    },
  };
}

export type GuardedIpcMain = GuardableIpc<IpcMainInvokeEvent, IpcMainEvent>;

export function registerIpcChannels(ipc: GuardedIpcMain, handlers: IpcHandlers): void {
  for (const name of IPC_REQUEST_NAMES) {
    ipc.handle(ipcRequests[name].channel, handlers.requests[name]);
  }
  for (const name of IPC_MESSAGE_NAMES) {
    ipc.on(ipcMessages[name].channel, handlers.messages[name]);
  }
}
