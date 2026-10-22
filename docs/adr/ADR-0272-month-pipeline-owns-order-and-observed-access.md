# ADR-0272: The month pipeline owns phase order and observes real snapshot access

## Status

Accepted (2026-10-22).

Amends: ADR-0247 item 6 and ADR-0250 item 3 (the month-end steps become their own phases). Structure only: no phase is reordered relative to the old sequence.

## Context

The turn list lived in three places: a phase registry in `phase-engine`, the runner that walked it, and the `TurnPhase` union the messages package consumed. Every phase descriptor also carried two hand-written lists side by side: its permissions and its footprint. `PhaseGuard.assert(phase.id, phase.footprint)` compared the second list against the first, so an omitted read was invisible — the declaration agreed with itself. And `battle_resolution` ran battle resolution and then, in the same body, presence measurement, foreign-station deployment and base limits.

## Decision

1. **Order is declared once.** `TURN_PHASES` in `@bluewave/contracts` is the turn contract; `@bluewave/messages` re-exports it. `MonthPipeline.create` requires exactly one implementation per contract phase and rejects missing, duplicate or unknown ids. It emits steps in contract order, with each checkpoint anchored after a named phase.
2. **The pipeline observes real access.** Each phase runs with a typed `SnapshotHandle` over the top-level snapshot aggregates. Reads are recorded as the phase reads through the handle; `write` records the aggregate written; assigning `current` diffs against the pending view without recording reads. After the body returns, observed reads, writes and RNG use are checked against the phase's declared permissions. A violation reports `PHASE_ACCESS_DENIED` naming the phase, resource and direction, discards the phase's pending writes and stops the month (fail closed).
3. **Permissions are snapshot aggregates** (`nations`, `wars`, `designs`, `designFamilies`, `world`, `politics`, `strategicWeather`, …), not economic sub-resources. Treasury, fleets, construction projects and research all live under `nations`.
4. **RNG enters through a grant.** `RandomGrant.seed()` and `RandomGrant.engine()` mark the phase as using randomness; a phase without `rng: true` fails closed when it uses either. This replaces the old self-declared `rngAllowed` flag.
5. **Battle resolution stops multitasking.** Presence measurement, foreign-station deployment and base limits become `presence_measurement`, `foreign_station_deployment` and `base_limits`, running after `battle_resolution` in that order. Deployment re-derives the presence demand from the same pure helper instead of receiving an array from another phase.
6. **Footprint duplication is deleted.** `PhaseRegistry`, `PhaseGuard`, `PhaseResource` and `PHASE_FOOTPRINTS` no longer exist; a `MonthPhase` carries its permissions and its deep body. Tests exercise phases through the pipeline interface, and the full order is pinned exactly once.
7. **Phase bodies are deep implementations.** A phase receives the context and owns its logic; narrow phases read aggregate slices (`resolve_research` reads `nations` and `world`, `resolve_diplomacy` reads and writes `wars`) rather than spreading the whole snapshot. Phases whose work genuinely spans the snapshot (`command_collection`, `ai_planning`, `ai_procurement`, `battle_generation`, `battle_resolution`) declare `reads: "all"`.

## Compatibility

No snapshot, save, wire or ruleset field changes; `CURRENT_COMPATIBILITY_VERSION` and every golden are unchanged. The observed access immediately surfaced two reads and one write the hand-written footprints had missed — deployment and presence consult blockade state (`wars`), and battle resolution writes `politics` when a surrender settles the war — which failed closed until declared.

## Consequences

- An omitted read is no longer invisible: the month fails and names the phase, the aggregate and the direction. Declaring a permission no longer proves anything by itself; the body must actually stay inside it.
- Adding or moving a phase is one edit to `TURN_PHASES` plus its implementation; the pipeline rejects a contract phase with no body and a body outside the contract.
- The ordered phase list is asserted once, so order changes show up as one deliberate test diff rather than drifting across three declarations.
- Authoritative outcomes are unchanged: the split phases occupy the same trailing position that `battle_resolution` held, and suspension still stops the month before them.
