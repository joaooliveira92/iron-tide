# ADR-0320: Electron shell navigation, permission and CSP policy

Applies to: desktop

## Status

Accepted (2026-10-27).

## Context

The engineering contract requires restrictive navigation, popup and Content
Security Policy controls. The main process set none of the navigation or
permission controls, so a renderer could open windows and navigate to any URL
with the preload bridge attached. The production CSP was set only by a response
header hook, listed `default-src` alone, and left `base-uri`, `form-action` and
`frame-ancestors` open. A runtime probe of the built app showed the header hook
does apply to the `file://` renderer (script, inline-script and connection
violations are reported), so the gap was the policy content and the lack of a
test, not delivery.

## Decision

- `shellGuards.ts` holds the policy as pure predicates plus one installer that
  takes the app and the default session as structural ports. It is installed once,
  before any window exists, so every web contents (including a recreated window)
  is guarded without per-window listeners.
- Renderer-created windows are always denied. There is no external-URL handling:
  nothing in the product opens external links, so none is added.
- `will-navigate` and `will-redirect` are cancelled unless the target is the
  packaged renderer entry (same `file:` path) or, in development only, the exact
  dev-server origin. `webview` attachment is cancelled.
- Permission requests and checks are denied unless the permission is in
  `ALLOWED_PERMISSIONS` and the requester is trusted. The only entry is
  `clipboard-sanitized-write`, used by the copy buttons. Device permissions are
  denied.
- The CSP stays a single definition in `csp.ts`, delivered by the header hook (no
  meta tag, which would intersect with the dev policy). Production declares
  `script-src 'self'`, `connect-src 'self'`, `font-src 'self'`, and `object-src`,
  `base-uri`, `form-action` and `frame-ancestors` as `'none'`. No `unsafe-eval`.
- Exception: `style-src` keeps `'unsafe-inline'`. `GlobeShell.tsx` and
  `gradient-background-text.tsx` render inline `<style>` elements. Styles cannot
  run code, and scripts stay strict. Removing the exception means moving those
  rules into the stylesheet or adding style nonces.
- Verification: unit tests for the predicates, the installer and the policy
  strings; `e2e/shell-security.spec.ts` drives the built app over `file://`; the
  packaged smoke asserts the same properties against the packaged binary.

## Consequences

- A new permission or external-link feature must add an explicit allow-list entry
  and a test; the default stays denial.
- Not yet addressed: renderer `sandbox` stays off (the ESM preload requires it),
  IPC sender-frame validation and Electron fuses.
