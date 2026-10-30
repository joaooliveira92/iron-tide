import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { CAMPAIGN_COMMAND_NAMES } from "../shared/campaign-command-descriptors.js";
import {
  IPC_EVENT_NAMES,
  IPC_MESSAGE_NAMES,
  IPC_REQUEST_NAMES,
  ipcEvents,
  ipcMessages,
  ipcRequests,
  type IpcMessageName,
  type IpcRequestName,
} from "../shared/ipc-contract.js";
import { createCampaignCommandDispatcher, getDefaultCommandRuntime } from "./campaignBridge.js";
import { parseRendererCrashInput, type CrashDetails } from "./crashSupport.js";
import {
  createIpcHandlers,
  registerIpcChannels,
  type GuardedIpcMain,
  type IpcDependencies,
  type IpcHandlers,
  type IpcHost,
  type IpcWindow,
} from "./ipc.js";
import {
  createPreferencesBridge,
  type PreferencesBridge,
} from "./preferences/preferencesBridge.js";
import { reportRendererCrash } from "./rendererCrash.js";
import type { CommandHandlers } from "./runtime/commandProgram.js";
import { CrashReporter } from "./runtime/crashReporter.js";
import { guardIpc, type GuardableIpc, type ShellTrust } from "./shellGuards.js";

const trust: ShellTrust = {
  entryUrl: "file:///Applications/Bluewave.app/Contents/Resources/app/out/renderer/index.html",
  devOrigin: null,
};

const trustedEvent = { senderFrame: { url: `${trust.entryUrl}#/overview` }, sender: { id: 1 } };
const untrustedEvent = { senderFrame: { url: "https://example.com/" }, sender: { id: 2 } };

interface PayloadCase {
  readonly label: string;
  readonly args: readonly unknown[];
  readonly reason: string;
}

interface RequestRow {
  readonly untrustedArgs: readonly unknown[];
  readonly malformed?: readonly PayloadCase[];
}

interface MessageRow {
  readonly untrustedArgs: readonly unknown[];
  readonly malformed?: readonly PayloadCase[];
}

const REQUEST_ROWS: Record<IpcRequestName, RequestRow> = {
  appReadStartup: { untrustedArgs: [] },
  campaignExecute: {
    untrustedArgs: ["inspectCampaign", { sessionId: "session-1" }],
    malformed: [
      {
        label: "malformed command payload",
        args: ["inspectCampaign", { sessionId: 42 }],
        reason: "INVALID_PAYLOAD",
      },
      {
        label: "excess-property command payload",
        args: ["loadRecentCampaign", { packagePath: "p", extra: true }],
        reason: "INVALID_PAYLOAD",
      },
    ],
  },
  preferencesRead: { untrustedArgs: [] },
  preferencesWrite: {
    untrustedArgs: [{ app: { theme: "dark" } }],
    malformed: [
      {
        label: "malformed preference payload",
        args: [{ app: { theme: "neon" } }],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
      {
        label: "excess-property preference payload",
        args: [{ app: { theme: "dark", extra: true } }],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
    ],
  },
  preferencesReadCampaign: {
    untrustedArgs: ["session-1"],
    malformed: [
      {
        label: "non-string session id",
        args: [42],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
      {
        label: "empty session id",
        args: [""],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
    ],
  },
  preferencesWriteCampaign: {
    untrustedArgs: ["session-1", { campaign: {} }],
    malformed: [
      {
        label: "non-string session id",
        args: [42, { campaign: {} }],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
      {
        label: "malformed campaign preference payload",
        args: ["session-1", { campaign: { showDetailedTooltips: "yes" } }],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
      {
        label: "excess-property campaign preference payload",
        args: ["session-1", { campaign: { extra: true } }],
        reason: "INVALID_PREFERENCES_PAYLOAD",
      },
    ],
  },
  windowGetState: { untrustedArgs: [] },
};

const MESSAGE_ROWS: Record<IpcMessageName, MessageRow> = {
  windowMinimize: { untrustedArgs: [] },
  windowMaximizeToggle: { untrustedArgs: [] },
  windowClose: { untrustedArgs: [] },
  reportCrash: {
    untrustedArgs: [{ kind: "window-error", message: "boom" }],
    malformed: [
      {
        label: "malformed crash report",
        args: [{ kind: "not-a-crash-kind", message: "boom" }],
        reason: "IGNORED",
      },
      {
        label: "excess-property crash report",
        args: [{ kind: "window-error", message: "boom", extra: true }],
        reason: "IGNORED",
      },
    ],
  },
  quitFlushComplete: { untrustedArgs: [] },
};

type Listener = (event: any, ...args: any[]) => unknown;

interface Harness {
  readonly handled: Map<string, Listener>;
  readonly listened: Map<string, Listener>;
  readonly reachedCommands: string[];
  readonly windowCalls: string[];
  readonly preferenceCalls: string[];
  readonly quitCalls: string[];
  readonly crashReportsReceived: unknown[];
  readonly capturedCrashes: unknown[];
  readonly crashWork: () => Promise<void>;
  readonly invokeRequest: (channel: string, args: readonly unknown[]) => Promise<unknown>;
  readonly invokeUntrustedRequest: (channel: string, args: readonly unknown[]) => Promise<unknown>;
  readonly invokeMessage: (channel: string, args: readonly unknown[]) => void;
  readonly invokeUntrustedMessage: (channel: string, args: readonly unknown[]) => void;
  readonly domainCalls: () => readonly unknown[];
}

function harness(): Harness {
  const handled = new Map<string, Listener>();
  const listened = new Map<string, Listener>();
  const reachedCommands: string[] = [];
  const windowCalls: string[] = [];
  const preferenceCalls: string[] = [];
  const quitCalls: string[] = [];
  const crashReportsReceived: unknown[] = [];
  const capturedCrashes: unknown[] = [];

  const window: IpcWindow = {
    isMaximized: () => false,
    isMaximizable: () => true,
    isMinimizable: () => true,
    minimize: () => void windowCalls.push("minimize"),
    maximize: () => void windowCalls.push("maximize"),
    unmaximize: () => void windowCalls.push("unmaximize"),
    close: () => void windowCalls.push("close"),
  };
  const host: IpcHost = { platform: "darwin", windowOf: () => window };

  const commandHandlers: Partial<CommandHandlers> = Object.fromEntries(
    CAMPAIGN_COMMAND_NAMES.map((name) => [
      name,
      () =>
        Effect.sync(() => {
          reachedCommands.push(name);
          return { outcome: "success" as const, value: null, diagnostics: [] };
        }),
    ]),
  );

  const realPreferences = createPreferencesBridge(getDefaultCommandRuntime);
  const preferences: PreferencesBridge = {
    read: () => {
      preferenceCalls.push("read");
      return realPreferences.read();
    },
    readWithRecovery: () => {
      preferenceCalls.push("readWithRecovery");
      return realPreferences.readWithRecovery();
    },
    write: (payload) => {
      preferenceCalls.push("write");
      return realPreferences.write(payload);
    },
    readCampaign: (sessionId) => {
      preferenceCalls.push("readCampaign");
      return realPreferences.readCampaign(sessionId);
    },
    writeCampaign: (sessionId, payload) => {
      preferenceCalls.push("writeCampaign");
      return realPreferences.writeCampaign(sessionId, payload);
    },
  };

  let crashWork: Promise<void> = Promise.resolve();
  const crashService: CrashReporter["Service"] = {
    capture: (_source, _kind, details: CrashDetails) =>
      Effect.sync(() => {
        capturedCrashes.push(details);
        return null;
      }),
    parseRendererInput: (value) => Effect.sync(() => parseRendererCrashInput(value)),
    installProcessHandlers: () => Effect.sync(() => () => undefined),
    createLimiter: () => Effect.sync(() => ({ allowed: () => true })),
    detailsFromError: () => Effect.sync(() => ({ message: "error" })),
  };

  const dependencies: IpcDependencies = {
    host,
    dispatchCampaignCommand: createCampaignCommandDispatcher(
      commandHandlers,
      getDefaultCommandRuntime,
    ),
    preferences,
    reportCrash: (report) => {
      crashReportsReceived.push(report);
      crashWork = Effect.runPromise(
        reportRendererCrash(report).pipe(Effect.provideService(CrashReporter, crashService)),
      );
    },
    quitFlushComplete: () => void quitCalls.push("complete"),
  };

  const handlers: IpcHandlers = createIpcHandlers(dependencies);
  const guarded: GuardableIpc<typeof trustedEvent, typeof trustedEvent> = guardIpc(
    {
      handle: (channel, listener) => void handled.set(channel, listener),
      on: (channel, listener) => void listened.set(channel, listener),
    },
    trust,
  );
  registerIpcChannels(guarded as GuardedIpcMain, handlers);

  return {
    handled,
    listened,
    reachedCommands,
    windowCalls,
    preferenceCalls,
    quitCalls,
    crashReportsReceived,
    capturedCrashes,
    crashWork: () => crashWork,
    invokeRequest: async (channel, args) => {
      const listener = handled.get(channel);
      if (listener === undefined) throw new Error(`No request handler for ${channel}`);
      return await listener(trustedEvent, ...args);
    },
    invokeUntrustedRequest: async (channel, args) => {
      const listener = handled.get(channel);
      if (listener === undefined) throw new Error(`No request handler for ${channel}`);
      return await listener(untrustedEvent, ...args);
    },
    invokeMessage: (channel, args) => {
      const listener = listened.get(channel);
      if (listener === undefined) throw new Error(`No message handler for ${channel}`);
      listener(trustedEvent, ...args);
    },
    invokeUntrustedMessage: (channel, args) => {
      const listener = listened.get(channel);
      if (listener === undefined) throw new Error(`No message handler for ${channel}`);
      listener(untrustedEvent, ...args);
    },
    domainCalls: () => [...reachedCommands, ...windowCalls, ...quitCalls, ...capturedCrashes],
  };
}

describe("IPC conformance table", () => {
  it("has exactly one row for every request and one-way channel in the contract", () => {
    expect(Object.keys(REQUEST_ROWS).sort()).toEqual([...IPC_REQUEST_NAMES].sort());
    expect(Object.keys(MESSAGE_ROWS).sort()).toEqual([...IPC_MESSAGE_NAMES].sort());
    expect(IPC_EVENT_NAMES).toEqual(["quitFlush", "windowStateChanged"]);
  });

  it("rejects an untrusted sender on every request channel before any dependency runs", async () => {
    for (const name of IPC_REQUEST_NAMES) {
      const channel = ipcRequests[name].channel;
      const table = harness();
      let caught: unknown = null;
      try {
        await table.invokeUntrustedRequest(channel, REQUEST_ROWS[name].untrustedArgs);
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({ _tag: "UntrustedSender", channel });
      expect(table.domainCalls()).toEqual([]);
      expect(table.preferenceCalls).toEqual([]);
      expect(table.crashReportsReceived).toEqual([]);
    }
  });

  it("drops an untrusted sender on every one-way channel before any dependency runs", () => {
    for (const name of IPC_MESSAGE_NAMES) {
      const channel = ipcMessages[name].channel;
      const table = harness();
      table.invokeUntrustedMessage(channel, MESSAGE_ROWS[name].untrustedArgs);
      expect(table.domainCalls()).toEqual([]);
      expect(table.preferenceCalls).toEqual([]);
      expect(table.crashReportsReceived).toEqual([]);
    }
  });

  it("refuses malformed and excess-property payloads on every payload-bearing request channel", async () => {
    for (const name of IPC_REQUEST_NAMES) {
      const cases = REQUEST_ROWS[name].malformed ?? [];
      for (const testCase of cases) {
        const table = harness();
        const result = await table.invokeRequest(ipcRequests[name].channel, testCase.args);
        expect(result, `${ipcRequests[name].channel}: ${testCase.label}`).toMatchObject({
          outcome: "error",
          reason: testCase.reason,
        });
        expect(table.reachedCommands, `${ipcRequests[name].channel}: ${testCase.label}`).toEqual(
          [],
        );
      }
    }
  });

  it("ignores malformed and excess-property payloads on every payload-bearing one-way channel", async () => {
    for (const name of IPC_MESSAGE_NAMES) {
      const cases = MESSAGE_ROWS[name].malformed ?? [];
      for (const testCase of cases) {
        const table = harness();
        table.invokeMessage(ipcMessages[name].channel, testCase.args);
        await table.crashWork();
        expect(
          table.crashReportsReceived,
          `${ipcMessages[name].channel}: ${testCase.label}`,
        ).toHaveLength(1);
        expect(table.capturedCrashes, `${ipcMessages[name].channel}: ${testCase.label}`).toEqual(
          [],
        );
        expect(table.domainCalls(), `${ipcMessages[name].channel}: ${testCase.label}`).toEqual([]);
      }
    }
  });

  it("registers no inbound listener for a main-to-renderer event channel", () => {
    const table = harness();
    for (const name of IPC_EVENT_NAMES) {
      expect(table.handled.has(ipcEvents[name].channel)).toBe(false);
      expect(table.listened.has(ipcEvents[name].channel)).toBe(false);
    }
  });
});
