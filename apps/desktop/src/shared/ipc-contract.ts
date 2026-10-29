import type { AppStartupSnapshot, BridgeResult, WindowState } from "./bridge-contract.js";
import type { CampaignCommandMap, CampaignCommandName } from "./campaign-contract.js";
import type {
  CampaignPreferencesSnapshot,
  PreferencesSnapshot,
  WriteAppPreferencesRequest,
  WriteCampaignPreferencesRequest,
} from "./preferences-contract.js";

export type IpcArguments = readonly unknown[];

export type CampaignCommandResult = BridgeResult<CampaignCommandMap[CampaignCommandName]["result"]>;

export interface RendererCrashReport {
  readonly kind: "window-error" | "unhandledrejection";
  readonly message: string;
  readonly stack?: string;
}

export interface IpcRequest<Arguments extends IpcArguments, Result> {
  readonly channel: string;
  readonly arguments?: Arguments;
  readonly result?: Result;
}

export interface IpcMessage<Arguments extends IpcArguments> {
  readonly channel: string;
  readonly arguments?: Arguments;
}

export interface IpcEvent<Arguments extends IpcArguments> {
  readonly channel: string;
  readonly arguments?: Arguments;
}

export const ipcRequest = <Arguments extends IpcArguments, Result>(
  channel: string,
): IpcRequest<Arguments, Result> => ({ channel });

export const ipcMessage = <Arguments extends IpcArguments>(
  channel: string,
): IpcMessage<Arguments> => ({
  channel,
});

export const ipcEvent = <Arguments extends IpcArguments>(channel: string): IpcEvent<Arguments> => ({
  channel,
});

export const ipcRequests = {
  campaignExecute: ipcRequest<[command: string, payload: unknown], CampaignCommandResult>(
    "campaign:execute",
  ),
  preferencesRead: ipcRequest<[], BridgeResult<PreferencesSnapshot>>("preferences:read"),
  preferencesWrite: ipcRequest<
    [request: WriteAppPreferencesRequest],
    BridgeResult<PreferencesSnapshot>
  >("preferences:write"),
  preferencesReadCampaign: ipcRequest<
    [sessionId: string],
    BridgeResult<CampaignPreferencesSnapshot>
  >("preferences:read-campaign"),
  preferencesWriteCampaign: ipcRequest<
    [sessionId: string, request: WriteCampaignPreferencesRequest],
    BridgeResult<CampaignPreferencesSnapshot>
  >("preferences:write-campaign"),
  appReadStartup: ipcRequest<[], BridgeResult<AppStartupSnapshot>>("app:read-startup"),
  windowGetState: ipcRequest<[], WindowState>("window:get-state"),
} as const;

export const ipcMessages = {
  windowMinimize: ipcMessage<[]>("window:minimize"),
  windowMaximizeToggle: ipcMessage<[]>("window:maximize-toggle"),
  windowClose: ipcMessage<[]>("window:close"),
  reportCrash: ipcMessage<[report: RendererCrashReport]>("support:report-crash"),
  quitFlushComplete: ipcMessage<[]>("app:quit-flush-complete"),
} as const;

export const ipcEvents = {
  quitFlush: ipcEvent<[]>("app:quit-flush"),
  windowStateChanged: ipcEvent<[]>("window:state-changed"),
} as const;

export type IpcRequestName = keyof typeof ipcRequests;
export type IpcMessageName = keyof typeof ipcMessages;
export type IpcEventName = keyof typeof ipcEvents;

export type IpcRequestArgs<Name extends IpcRequestName> = NonNullable<
  (typeof ipcRequests)[Name]["arguments"]
>;
export type IpcRequestResult<Name extends IpcRequestName> = NonNullable<
  (typeof ipcRequests)[Name]["result"]
>;
export type IpcMessageArgs<Name extends IpcMessageName> = NonNullable<
  (typeof ipcMessages)[Name]["arguments"]
>;

export const IPC_REQUEST_NAMES = Object.keys(ipcRequests) as readonly IpcRequestName[];
export const IPC_MESSAGE_NAMES = Object.keys(ipcMessages) as readonly IpcMessageName[];
export const IPC_EVENT_NAMES = Object.keys(ipcEvents) as readonly IpcEventName[];
