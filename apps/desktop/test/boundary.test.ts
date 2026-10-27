import { describe, it, expect } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyContentSecurityPolicy,
  CONTENT_SECURITY_POLICY,
  DEV_CONTENT_SECURITY_POLICY,
} from "../src/main/csp.js";

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

  it("registers only the allow-listed IPC handlers in the main process", () => {
    const mainSource = readFileSync(resolve(__dirname, "../src/main/index.ts"), "utf8");
    const allowedHandle = [
      'ipc.handle("campaign:execute"',
      'ipc.handle("window:get-state"',
      'ipc.handle("preferences:read"',
      'ipc.handle("preferences:write"',
      'ipc.handle("preferences:read-campaign"',
      'ipc.handle("preferences:write-campaign"',
    ];
    const allowedOn = [
      'ipc.on("window:minimize"',
      'ipc.on("window:maximize-toggle"',
      'ipc.on("window:close"',
      'ipc.on("support:report-crash"',
    ];
    for (const handler of [...allowedHandle, ...allowedOn]) {
      expect(mainSource).toContain(handler);
    }
    const registeredHandle = mainSource.match(/ipc\.handle\("[^"]+"/g) ?? [];
    const registeredOn = mainSource.match(/ipc\.on\("[^"]+"/g) ?? [];
    expect(registeredHandle.length).toBe(allowedHandle.length);
    expect(registeredOn.length).toBe(allowedOn.length);
  });

  it("narrows the preload bridge to only the allow-listed top-level members", () => {
    const preloadSource = readFileSync(resolve(__dirname, "../src/preload/index.ts"), "utf8");
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld");
    const exposed = preloadSource.match(/^\s{2}([a-zA-Z]+):/gm) ?? [];
    const allowed = [
      "campaign:",
      "preferences:",
      "platform:",
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
    const mainSource = readFileSync(resolve(__dirname, "../src/main/index.ts"), "utf8");
    expect(mainSource).toContain("dispatchCampaignCommand");
    const registered = mainSource.match(/ipcMain\.(handle|on)\("([^"]+)"/g) ?? [];
    expect(
      registered.every((r) =>
        /"(campaign:execute|window:[a-z-]+|support:report-crash|preferences:[a-z-]+)"/.test(r),
      ),
    ).toBe(true);
  });
});
