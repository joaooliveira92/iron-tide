import { describe, expect, it } from "vite-plus/test";
import {
  ALLOWED_PERMISSIONS,
  installShellGuards,
  isPermissionAllowed,
  isTrustedNavigation,
  type GuardedApp,
  type GuardedContents,
  type GuardedSession,
  type ShellTrust,
} from "./shellGuards.js";

const packaged: ShellTrust = {
  entryUrl: "file:///Applications/Bluewave.app/Contents/Resources/app/out/renderer/index.html",
  devOrigin: null,
};

const development: ShellTrust = { ...packaged, devOrigin: "http://localhost:5173" };

describe("isTrustedNavigation", () => {
  it("allows the packaged entry point, with or without a hash or query", () => {
    expect(isTrustedNavigation(packaged.entryUrl, packaged)).toBe(true);
    expect(isTrustedNavigation(`${packaged.entryUrl}#/overview`, packaged)).toBe(true);
    expect(isTrustedNavigation(`${packaged.entryUrl}?x=1`, packaged)).toBe(true);
  });

  it.each([
    ["an unexpected https URL", "https://example.com/"],
    ["an http URL", "http://example.com/"],
    ["a file URL outside the entry point", "file:///etc/passwd"],
    [
      "a sibling file in the renderer directory",
      "file:///Applications/Bluewave.app/Contents/Resources/app/out/renderer/other.html",
    ],
    ["a javascript URL", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
    ["a blob URL", "blob:file:///abc"],
    ["a malformed URL", "not a url"],
    ["an empty URL", ""],
  ])("denies %s in production", (_label, url) => {
    expect(isTrustedNavigation(url, packaged)).toBe(false);
  });

  it("denies the dev server origin when not in development", () => {
    expect(isTrustedNavigation("http://localhost:5173/", packaged)).toBe(false);
  });

  it("allows only the exact dev server origin in development", () => {
    expect(isTrustedNavigation("http://localhost:5173/", development)).toBe(true);
    expect(isTrustedNavigation("http://localhost:5173/src/main.tsx", development)).toBe(true);
    expect(isTrustedNavigation("http://localhost:5174/", development)).toBe(false);
    expect(isTrustedNavigation("https://localhost:5173/", development)).toBe(false);
    expect(isTrustedNavigation("http://localhost:5173.evil.test/", development)).toBe(false);
    expect(isTrustedNavigation("http://evil.test/", development)).toBe(false);
  });
});

describe("isPermissionAllowed", () => {
  it("allows only the allow-listed permissions", () => {
    expect([...ALLOWED_PERMISSIONS]).toEqual(["clipboard-sanitized-write"]);
    expect(isPermissionAllowed("clipboard-sanitized-write", packaged.entryUrl, packaged)).toBe(
      true,
    );
  });

  it.each([
    "media",
    "geolocation",
    "notifications",
    "midi",
    "clipboard-read",
    "openExternal",
    "fullscreen",
    "unknown-future-permission",
  ])("denies %s", (permission) => {
    expect(isPermissionAllowed(permission, packaged.entryUrl, packaged)).toBe(false);
  });

  it("denies an allow-listed permission requested by an untrusted origin", () => {
    expect(isPermissionAllowed("clipboard-sanitized-write", "https://example.com/", packaged)).toBe(
      false,
    );
    expect(isPermissionAllowed("clipboard-sanitized-write", "", packaged)).toBe(false);
  });
});

type Listener = (event: { preventDefault(): void; readonly url: string }) => void;

class FakeContents implements GuardedContents {
  windowOpenHandler: (() => { action: "deny" }) | null = null;
  readonly listeners = new Map<string, Listener[]>();

  setWindowOpenHandler(handler: () => { action: "deny" }): void {
    this.windowOpenHandler = handler;
  }

  on(event: string, listener: Listener): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  fire(event: string, url: string): boolean {
    let prevented = false;
    for (const listener of this.listeners.get(event) ?? []) {
      listener({
        url,
        preventDefault: () => {
          prevented = true;
        },
      });
    }
    return prevented;
  }
}

class FakeApp implements GuardedApp {
  readonly created: Array<(event: unknown, contents: GuardedContents) => void> = [];

  on(
    event: "web-contents-created",
    listener: (event: unknown, contents: GuardedContents) => void,
  ): void {
    this.created.push(listener);
  }

  create(): FakeContents {
    const contents = new FakeContents();
    for (const listener of this.created) listener({}, contents);
    return contents;
  }
}

class FakeSession implements GuardedSession {
  requestHandler:
    | ((
        contents: unknown,
        permission: string,
        callback: (granted: boolean) => void,
        details: { requestingUrl: string },
      ) => void)
    | null = null;
  checkHandler:
    | ((
        contents: unknown,
        permission: string,
        origin: string,
        details: { requestingUrl: string },
      ) => boolean)
    | null = null;
  deviceHandler: (() => boolean) | null = null;

  setPermissionRequestHandler(handler: NonNullable<FakeSession["requestHandler"]>): void {
    this.requestHandler = handler;
  }
  setPermissionCheckHandler(handler: NonNullable<FakeSession["checkHandler"]>): void {
    this.checkHandler = handler;
  }
  setDevicePermissionHandler(handler: () => boolean): void {
    this.deviceHandler = handler;
  }
}

describe("installShellGuards", () => {
  const install = (trust: ShellTrust) => {
    const app = new FakeApp();
    const session = new FakeSession();
    installShellGuards({ app, session, trust });
    return { app, session };
  };

  it("denies every renderer-created window", () => {
    const { app } = install(packaged);
    const contents = app.create();
    expect(contents.windowOpenHandler?.()).toEqual({ action: "deny" });
  });

  it("blocks navigation and redirects to untrusted destinations only", () => {
    const { app } = install(packaged);
    const contents = app.create();
    for (const event of ["will-navigate", "will-redirect"]) {
      expect(contents.fire(event, "https://example.com/")).toBe(true);
      expect(contents.fire(event, "javascript:alert(1)")).toBe(true);
      expect(contents.fire(event, packaged.entryUrl)).toBe(false);
    }
  });

  it("blocks webview attachment", () => {
    const { app } = install(packaged);
    const contents = app.create();
    expect(contents.fire("will-attach-webview", "https://example.com/")).toBe(true);
  });

  it("guards every web contents created later, including a recreated window", () => {
    const { app } = install(packaged);
    const first = app.create();
    const second = app.create();
    expect(second.windowOpenHandler?.()).toEqual({ action: "deny" });
    expect(second.fire("will-navigate", "https://example.com/")).toBe(true);
    expect(first.fire("will-navigate", "https://example.com/")).toBe(true);
  });

  it("registers one app listener and one handler per contents regardless of window count", () => {
    const { app } = install(packaged);
    app.create();
    app.create();
    const third = app.create();
    expect(app.created).toHaveLength(1);
    expect(third.listeners.get("will-navigate")).toHaveLength(1);
    expect(third.listeners.get("will-redirect")).toHaveLength(1);
  });

  it("denies permission requests by default and grants only the allow-listed one", () => {
    const { session } = install(packaged);
    const decide = (permission: string, requestingUrl: string): boolean => {
      let granted: boolean | null = null;
      session.requestHandler?.({}, permission, (value) => (granted = value), { requestingUrl });
      return granted === true;
    };
    expect(decide("media", packaged.entryUrl)).toBe(false);
    expect(decide("clipboard-sanitized-write", "https://example.com/")).toBe(false);
    expect(decide("clipboard-sanitized-write", packaged.entryUrl)).toBe(true);
  });

  it("applies the same decision to permission checks and denies device access", () => {
    const { session } = install(packaged);
    const check = (permission: string, requestingUrl: string): boolean | undefined =>
      session.checkHandler?.({}, permission, "file://", { requestingUrl });
    expect(check("geolocation", packaged.entryUrl)).toBe(false);
    expect(check("clipboard-sanitized-write", packaged.entryUrl)).toBe(true);
    expect(check("clipboard-sanitized-write", "https://example.com/")).toBe(false);
    expect(session.deviceHandler?.()).toBe(false);
  });

  it("trusts the dev server only when configured for development", () => {
    const { app } = install(development);
    const contents = app.create();
    expect(contents.fire("will-navigate", "http://localhost:5173/")).toBe(false);
    expect(contents.fire("will-navigate", "http://localhost:9999/")).toBe(true);
  });
});
