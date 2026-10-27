export interface ShellTrust {
  readonly entryUrl: string;
  readonly devOrigin: string | null;
}

export const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set(["clipboard-sanitized-write"]);

function parse(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isTrustedNavigation(rawUrl: string, trust: ShellTrust): boolean {
  const url = parse(rawUrl);
  if (url === null) return false;
  if (url.protocol === "file:") {
    const entry = parse(trust.entryUrl);
    return entry !== null && url.host === "" && url.pathname === entry.pathname;
  }
  if (trust.devOrigin !== null && url.protocol === "http:") {
    const dev = parse(trust.devOrigin);
    return dev !== null && url.origin === dev.origin;
  }
  return false;
}

export function isPermissionAllowed(
  permission: string,
  requestingUrl: string,
  trust: ShellTrust,
): boolean {
  return ALLOWED_PERMISSIONS.has(permission) && isTrustedNavigation(requestingUrl, trust);
}

interface GuardEvent {
  preventDefault(): void;
  readonly url?: string;
}

export interface GuardedContents {
  setWindowOpenHandler(handler: () => { action: "deny" }): void;
  on(
    event: "will-navigate" | "will-redirect" | "will-attach-webview",
    listener: (event: GuardEvent) => void,
  ): void;
}

export interface GuardedApp {
  on(
    event: "web-contents-created",
    listener: (event: unknown, contents: GuardedContents) => void,
  ): void;
}

interface PermissionDetails {
  readonly requestingUrl?: string;
}

export interface GuardedSession {
  setPermissionRequestHandler(
    handler: (
      contents: unknown,
      permission: string,
      callback: (granted: boolean) => void,
      details: PermissionDetails,
    ) => void,
  ): void;
  setPermissionCheckHandler(
    handler: (
      contents: unknown,
      permission: string,
      requestingOrigin: string,
      details: PermissionDetails,
    ) => boolean,
  ): void;
  setDevicePermissionHandler(handler: () => boolean): void;
}

export interface ShellGuardTargets {
  readonly app: GuardedApp;
  readonly session: GuardedSession;
  readonly trust: ShellTrust;
}

export function installShellGuards({ app, session, trust }: ShellGuardTargets): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    const guardNavigation = (event: GuardEvent): void => {
      if (!isTrustedNavigation(event.url ?? "", trust)) event.preventDefault();
    };
    contents.on("will-navigate", guardNavigation);
    contents.on("will-redirect", guardNavigation);
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });

  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(isPermissionAllowed(permission, details.requestingUrl ?? "", trust));
  });
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) =>
    isPermissionAllowed(permission, details.requestingUrl ?? requestingOrigin, trust),
  );
  session.setDevicePermissionHandler(() => false);
}
