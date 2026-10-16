# D2: Home and shape of the preferences domain

**Type:** grilling · **Status:** resolved

## Question

Where does the versioned preferences model live, and how is it split so the
renderer stays runtime-free (no `effect`) while the boundary is decoded with
Effect `Schema`?

## Answer

Preferences are an **application** concern, not a game-domain concern (they never
enter authoritative state). They therefore live inside the desktop app rather
than in a new `@bluewave/*` package — this honours "do not introduce speculative
packages" (contract §Technology) and matches the existing app-level sidecars.

- **Strict model + IO (main process only):** a preferences module under the
  desktop main process holds the versioned Effect `Schema`, the central defaults,
  the compatibility/version constant, the pure migration steps, the scope
  resolution, and the atomic file store. It may import `effect` because it is an
  IO/entrypoint boundary.
- **Renderer-facing contract (effect-free):** the stable preference keys, value
  unions, scope enum, and the plain (decoded) preference shape live in the shared
  desktop layer beside the existing bridge contract. The renderer and preload
  import this effect-free module only; they import no `effect`.
- **Parity:** a test asserts the shared renderer type matches the decoded type of
  the Effect `Schema` (the wire-format parity rule, `RULES.md` §Schema), so the two
  definitions cannot drift.

Persistence reuses the existing hand-rolled atomic-write pattern (`tmp` + rename)
already used by the campaign sidecars; no new persistence dependency
(`electron-store` is absent and stays absent).

No new ADR is required for the home: ADR-0203 already fixes the architecture, and
"app-local, not a domain package" is a routine local design choice. The concrete
module names are settled at implementation.

## Why

The renderer must never import `effect` (runtime-free gate, ADR-0159), and the
boundary must be decoded with strict Effect `Schema` (ADR-0102/0105,
`assert-boundary-decode.mjs`). Splitting an effect-free shared contract from a
main-process strict schema satisfies both without a package that the renderer
would have to half-import. Preferences being non-authoritative means they must
not move any golden hash (D7).
