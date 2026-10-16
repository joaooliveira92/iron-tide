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
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
    );
    // Scripts stay strict: no inline/eval grant in production.
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src");
    // Pre-existing headers are preserved.
    expect(headers["X-Frame-Options"]).toEqual(["DENY"]);
  });

  it("defaults to the strict CSP when isDev is omitted", () => {
    const headers = applyContentSecurityPolicy({});
    expect(headers["Content-Security-Policy"]).toEqual([CONTENT_SECURITY_POLICY]);
  });

  it("relaxes CSP only for the dev server origin when isDev is true, never in production", () => {
    const headers = applyContentSecurityPolicy({}, true);
    expect(headers["Content-Security-Policy"]).toEqual([DEV_CONTENT_SECURITY_POLICY]);
    // The relaxation is scoped to Vite's dev server, not a blanket unsafe-inline/eval grant.
    expect(DEV_CONTENT_SECURITY_POLICY).toContain("http://localhost:5173");
    expect(DEV_CONTENT_SECURITY_POLICY).not.toBe(CONTENT_SECURITY_POLICY);

    const prodHeaders = applyContentSecurityPolicy({}, false);
    expect(prodHeaders["Content-Security-Policy"]).toEqual([CONTENT_SECURITY_POLICY]);
  });

  /**
   * Desktop-mvp ticket 11 retired the old compile/project/campaign-save-file
   * IPC surface (superseded by `compiler-cli`) and replaced it with the
   * `campaign:execute` bridge plus frameless-window controls. These tests
   * assert the new allow-list the same way the old ones asserted B9's.
   */
  it("registers only the allow-listed IPC handlers in the main process", () => {
    const mainSource = readFileSync(resolve(__dirname, "../src/main/index.ts"), "utf8");
    const allowedHandle = [
      'ipcMain.handle("campaign:execute"',
      'ipcMain.handle("window:get-state"',
      // The dedicated app-scope preferences capability (D6): a narrow read/write
      // pair, separate from the campaign command channel.
      'ipcMain.handle("preferences:read"',
      'ipcMain.handle("preferences:write"',
    ];
    const allowedOn = [
      'ipcMain.on("window:minimize"',
      'ipcMain.on("window:maximize-toggle"',
      'ipcMain.on("window:close"',
      // Local-only crash support bundle (ADR-0133): the renderer forwards a
      // validated crash payload; no other renderer→main channel is added.
      'ipcMain.on("support:report-crash"',
    ];
    for (const handler of [...allowedHandle, ...allowedOn]) {
      expect(mainSource).toContain(handler);
    }
    const registeredHandle = mainSource.match(/ipcMain\.handle\("[^"]+"/g) ?? [];
    const registeredOn = mainSource.match(/ipcMain\.on\("[^"]+"/g) ?? [];
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
      // ADR-0133: renderer crash forwarding (validated in main).
      "reportCrash:",
    ];
    expect(exposed.length).toBe(allowed.length);
    for (const method of allowed) {
      expect(exposed.some((s) => s.trim().startsWith(method))).toBe(true);
    }
  });

  it("dispatches every command through the single campaign:execute channel, none directly", () => {
    const mainSource = readFileSync(resolve(__dirname, "../src/main/index.ts"), "utf8");
    // Individual campaign commands (compileCampaign, commitMonth, etc.) must
    // never get their own ipcMain.handle/on registration — they're all
    // dispatched through dispatchCampaignCommand's registry
    // (src/main/campaignBridge.ts), keeping the IPC surface fixed as the
    // command set grows.
    expect(mainSource).toContain("dispatchCampaignCommand");
    const registered = mainSource.match(/ipcMain\.(handle|on)\("([^"]+)"/g) ?? [];
    expect(
      registered.every((r) =>
        /"(campaign:execute|window:[a-z-]+|support:report-crash|preferences:[a-z]+)"/.test(r),
      ),
    ).toBe(true);
  });
});
