const LOCKED_DIRECTIVES = [
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  ...LOCKED_DIRECTIVES,
].join("; ");

export const DEV_CONTENT_SECURITY_POLICY = [
  "default-src 'self' http://localhost:5173",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173",
  "style-src 'self' 'unsafe-inline' http://localhost:5173",
  "img-src 'self' data: http://localhost:5173",
  "connect-src 'self' ws://localhost:5173 http://localhost:5173",
  ...LOCKED_DIRECTIVES,
].join("; ");

const UNMANAGED_PROTOCOLS = ["chrome-extension:", "devtools:"];

export interface CspHeaderDetails {
  readonly url: string;
  readonly responseHeaders?: Record<string, string[]>;
}

export interface CspHeaderResult {
  readonly responseHeaders?: Record<string, string[]>;
}

export interface CspSession {
  readonly webRequest: {
    onHeadersReceived(
      listener: (details: CspHeaderDetails, callback: (result: CspHeaderResult) => void) => void,
    ): void;
  };
}

export function installContentSecurityPolicy(session: CspSession, isDev: boolean): void {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback(
      shouldApplyContentSecurityPolicy(details.url)
        ? { responseHeaders: applyContentSecurityPolicy(details.responseHeaders, isDev) }
        : {},
    );
  });
}

export function shouldApplyContentSecurityPolicy(url: string): boolean {
  return !UNMANAGED_PROTOCOLS.some((protocol) => url.startsWith(protocol));
}

export function applyContentSecurityPolicy(
  responseHeaders: Record<string, string[]> | undefined,
  isDev = false,
): Record<string, string[]> {
  return {
    ...responseHeaders,
    "Content-Security-Policy": [isDev ? DEV_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY],
  };
}
