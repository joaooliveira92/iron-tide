export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";

export const DEV_CONTENT_SECURITY_POLICY = [
  "default-src 'self' http://localhost:5173",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173",
  "style-src 'self' 'unsafe-inline' http://localhost:5173",
  "img-src 'self' data: http://localhost:5173",
  "connect-src 'self' ws://localhost:5173 http://localhost:5173",
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
