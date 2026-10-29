import { describe, it, expect } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyContentSecurityPolicy,
  CONTENT_SECURITY_POLICY,
  DEV_CONTENT_SECURITY_POLICY,
} from "../src/main/csp.js";
import { createIpcHandlers, registerIpcChannels, type IpcDependencies } from "../src/main/ipc.js";
import { ipcEvents, ipcMessages, ipcRequests } from "../src/shared/ipc-contract.js";

function channelsOf(table: Readonly<Record<string, { readonly channel: string }>>): string[] {
  return Object.values(table)
    .map((entry) => entry.channel)
    .sort();
}

const CONTRACT_CHANNELS = [
  ...channelsOf(ipcRequests),
  ...channelsOf(ipcMessages),
  ...channelsOf(ipcEvents),
];

function unusedIpcDependencies(): IpcDependencies {
  const unused = (): Promise<never> => new Promise<never>(() => undefined);
  return {
    host: { platform: "darwin", windowOf: () => null },
    dispatchCampaignCommand: unused,
    preferences: {
      read: unused,
      readWithRecovery: unused,
      write: unused,
      readCampaign: unused,
      writeCampaign: unused,
    },
    reportCrash: () => undefined,
    quitFlushComplete: () => undefined,
  };
}

describe("Electron boundary", () => {
  it("applies `default-src 'self'` CSP to renderer responses", () => {
    const headers = applyContentSecurityPolicy({ "X-Frame-Options": ["DENY"] });
    expect(headers["Content-Security-Policy"]).toEqual([CONTENT_SECURITY_POLICY]);
    expect(CONTENT_SECURITY_POLICY).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(headers["X-Frame-Options"]).toEqual(["DENY"]);
  });

  it("defaults to the strict CSP when isDev is omitted", () => {
    const headers = applyContentSecurityPolicy({});
    expect(headers["Content-Security-Policy"]).toEqual([CONTENT_SECURITY_POLICY]);
  });

  it("relaxes CSP only for the dev server origin when isDev is true, never in production", () => {
    const headers = applyContentSecurityPolicy({}, true);
    expect(headers["Content-Security-Policy"]).toEqual([DEV_CONTENT_SECURITY_POLICY]);
    expect(DEV_CONTENT_SECURITY_POLICY).toContain("http://localhost:5173");
    expect(DEV_CONTENT_SECURITY_POLICY).not.toBe(CONTENT_SECURITY_POLICY);

    const prodHeaders = applyContentSecurityPolicy({}, false);
    expect(prodHeaders["Content-Security-Policy"]).toEqual([CONTENT_SECURITY_POLICY]);
  });

  it("declares every bridge channel exactly once in the shared contract", () => {
    expect(channelsOf(ipcRequests)).toEqual([
      "app:read-startup",
      "campaign:execute",
      "preferences:read",
      "preferences:read-campaign",
      "preferences:write",
      "preferences:write-campaign",
      "window:get-state",
    ]);
    expect(channelsOf(ipcMessages)).toEqual([
      "app:quit-flush-complete",
      "support:report-crash",
      "window:close",
      "window:maximize-toggle",
      "window:minimize",
    ]);
    expect(channelsOf(ipcEvents)).toEqual(["app:quit-flush", "window:state-changed"]);
    expect(new Set(CONTRACT_CHANNELS).size).toBe(CONTRACT_CHANNELS.length);
  });

  it("registers every contract channel, and only those, in the main process", () => {
    const registered: string[] = [];
    const ipc = {
      handle: (channel: string) => {
        registered.push(channel);
      },
      on: (channel: string) => {
        registered.push(channel);
      },
    };

    registerIpcChannels(ipc, createIpcHandlers(unusedIpcDependencies()));

    expect([...registered].sort()).toEqual(
      [...channelsOf(ipcRequests), ...channelsOf(ipcMessages)].sort(),
    );
  });

  it("takes every channel name from the contract in both preload and main", () => {
    for (const file of ["../src/preload/index.ts", "../src/main/index.ts", "../src/main/ipc.ts"]) {
      const source = readFileSync(resolve(__dirname, file), "utf8");
      for (const channel of CONTRACT_CHANNELS) {
        expect(source).not.toContain(`"${channel}"`);
        expect(source).not.toContain(`'${channel}'`);
      }
    }
  });

  it("narrows the preload bridge to only the allow-listed top-level members", () => {
    const preloadSource = readFileSync(resolve(__dirname, "../src/preload/index.ts"), "utf8");
    const exposedStart = preloadSource.indexOf("contextBridge.exposeInMainWorld");
    expect(exposedStart).toBeGreaterThanOrEqual(0);
    const exposed = preloadSource.slice(exposedStart).match(/^\s{2}([a-zA-Z]+):/gm) ?? [];
    const allowed = [
      "campaign:",
      "preferences:",
      "platform:",
      "readStartupSnapshot:",
      "getWindowState:",
      "windowMinimize:",
      "windowMaximizeToggle:",
      "windowClose:",
      "onQuitFlush:",
      "notifyQuitFlushComplete:",
      "reportCrash:",
    ];
    expect(exposed.length).toBe(allowed.length);
    for (const method of allowed) {
      expect(exposed.some((s) => s.trim().startsWith(method))).toBe(true);
    }
  });

  it("dispatches every command through the single campaign:execute channel, none directly", () => {
    const campaignChannels = channelsOf(ipcRequests).filter((channel) =>
      channel.startsWith("campaign:"),
    );
    expect(campaignChannels).toEqual(["campaign:execute"]);
  });
});
