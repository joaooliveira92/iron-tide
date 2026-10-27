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

export function applyContentSecurityPolicy(
  responseHeaders: Record<string, string[]> | undefined,
  isDev = false,
): Record<string, string[]> {
  return {
    ...responseHeaders,
    "Content-Security-Policy": [isDev ? DEV_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY],
  };
}
