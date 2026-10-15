/**
 * `style-src` allows 'unsafe-inline' because motion, the shader components and
 * Tailwind-driven components set inline `style` attributes at runtime; without
 * it Chromium blocks them. Scripts stay strict (`default-src 'self'`), which is
 * what matters for XSS; inline styles are a low-risk grant for a local bundle.
 *
 * `img-src` allows `data:` in addition to `self` because the shader
 * background components (@paper-design/shaders-react) load their
 * placeholder/unset image uniforms from an inline `data:image/gif` pixel,
 * not just same-origin files.
 *
 * Under this strict policy a library that feature-detects `unsafe-eval` would
 * log a CSP console error even though it swallows the throw. The renderer ships
 * no such library (validation lives in the main process), so the packaged
 * smoke's console check stays a true signal; keep it that way.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";

/**
 * Vite's React-refresh preamble (injected by @vitejs/plugin-react for HMR)
 * is an inline <script> the plugin controls, not something we author or can
 * externalize — it requires 'unsafe-inline' (and 'unsafe-eval' for Vite's
 * dev-time module transforms). Only used when loading the dev server
 * (localhost:5173); production loads a static built bundle under the
 * strict policy above.
 */
export const DEV_CONTENT_SECURITY_POLICY = [
  "default-src 'self' http://localhost:5173",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173",
  "style-src 'self' 'unsafe-inline' http://localhost:5173",
  "img-src 'self' data: http://localhost:5173",
  "connect-src 'self' ws://localhost:5173 http://localhost:5173",
].join("; ");

/**
 * Applies the renderer Content-Security-Policy to a response-header map.
 * Pure and Electron-free so it can be unit tested without launching Electron.
 */
export function applyContentSecurityPolicy(
  responseHeaders: Record<string, string[]> | undefined,
  isDev = false,
): Record<string, string[]> {
  return {
    ...responseHeaders,
    "Content-Security-Policy": [isDev ? DEV_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY],
  };
}
