# ADR-0319: Debug-only screens stay internal and leave the production renderer bundle

Applies to: desktop

## Status

Accepted (2026-10-26). Resolves [#226](https://github.com/joaooliveira92/iron-tide/issues/226).

## Context

Simulation & Turn, Tactical Sandbox and Debugging & Telemetry register only when
`DEBUG_MODE` is set. Their status was implicit: the reachability ledger treated the
battle sandbox as dormant, and a production renderer build still emitted the three
screen chunks because their lazy imports were unconditional. The screens contain
useful diagnostics but are not player verbs, and the production player battle
path is the separate `PlayerBattleScreen`.

## Decision

- All three screens remain debug tooling, classified `internal` in the
  reachability ledger. None is promoted or retired in this decision.
- Simulation & Turn remains the time-lapse and turn-report inspector.
  Tactical Sandbox remains the generation/replay diagnostic surface; production
  battle offers and fought battles do not depend on it. Debugging & Telemetry
  remains a developer readout.
- The production renderer must not emit their chunks or register their routes.
  Lazy imports are guarded by the compile-time `VITE_BLUEWAVE_DEBUG` flag, which
  Vite replaces during the production build.
- `apps/desktop/scripts/check-renderer-bundle.mjs` rejects a production renderer
  bundle that contains the three screen markers. Debug builds skip that check
  because they intentionally include the screens.
- Promoting any of the three needs a new issue, a production path behind every
  control, a reachability-ledger row and UI evidence; the decision is not amended
  implicitly by adding a route.

## Consequences

- Production chunks shrink and a debug-only screen cannot leak into a release
  through a registry mistake.
- The debug screens stay available in `pnpm dev:debug` and `pnpm build:debug`.
- Game state, hashes, saves and replay compatibility are unaffected.
