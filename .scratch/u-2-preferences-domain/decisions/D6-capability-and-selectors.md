# D6: IPC capability and typed selectors

**Type:** grilling · **Status:** resolved

## Question

How do preferences cross the Electron boundary, and how does the renderer read
and write them without importing `effect`?

## Answer

A **dedicated narrow preload capability** — `preferences.read` and
`preferences.write` on the existing `window.bluewave` bridge — separate from the
campaign command channel, because app-scope preferences exist with no open
campaign and no session. Each call is a named method with a typed request; there
is no generic passthrough.

- **Request/response decoding:** every payload is decoded at the main boundary
  with a strict Effect `Schema` using `{ onExcessProperty: "error" }` (the
  `withStrictSchema` pattern already used for commands); a bad or excess-key
  payload fails with a stable `_tag`, never a raw error.
- **Writes** validate and authorize before persisting; a write returns the newly
  effective preferences. App-scope writes are atomic (temp + rename); campaign
  writes land in the campaign sidecar beside the existing per-campaign files.
- **Typed selectors:** renderer-side hooks read the decoded preference shape from
  the effect-free shared contract (D2) and expose typed, per-key selectors; they
  never import `effect`, never read `localStorage`, and never format or convert
  values (formatting is U-3).
- **Migration of existing consumers:** the existing theme/background/font/density
  controls are rewired to the domain selectors, and the campaign
  display-preference hook is rewired to campaign-scope preferences, so
  `localStorage` is no longer a preference store.

## Why

The contract requires context isolation, narrow capability-specific preload
methods, and strict Effect `Schema` decoding of IPC with no
`JSON.parse(...) as T` (`assert-boundary-decode.mjs`, ADR-0102/0105). The renderer
must import no `effect` and no authoritative engine packages (runtime-free gate,
ADR-0159). A dedicated preferences capability keeps app-scope settings working
before any campaign exists, and typed selectors give U-4 a clean seam to build the
screen on.
