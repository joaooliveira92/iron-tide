# ADR-0359: Phase-engine and event architecture

Consolidates: ADR-0272, ADR-0294, ADR-0306

Applies to: campaign-engine, contracts, desktop, events, messages, phase-engine

Rule: Phase order is declared once in `TURN_PHASES`; phases access snapshot aggregates through recorded handles with declared permissions; event body types derive from Effect schemas with no mirrored interfaces.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0272
Supersedes: ADR-0294
Supersedes: ADR-0306

## Context

The turn list lived in three places: a phase registry in `phase-engine`, the runner that walked it, and the `TurnPhase` union in the messages package. Every phase descriptor carried two hand-written lists—its permissions and its footprint—and `PhaseGuard.assert` compared one against the other, so an omitted read was invisible. Battle resolution ran presence measurement, foreign-station deployment and base limits in the same body. Separately, event body types were hand-mirrored interfaces alongside their Effect schemas, so a schema change required two edits and no type error caught a drift. And the desktop projection engine in `@bluewave/campaign-engine` needed to carry `ExplanationTree` fields alongside displayed numbers (ADR-0304), but the tree contract lived in `@bluewave/events` at the same layer, which the package graph gate rejected.

## Decision

1. **Phase order is declared once in `TURN_PHASES`.** `@bluewave/contracts` owns the turn contract; `@bluewave/messages` re-exports it. `MonthPipeline.create` requires exactly one implementation per contract phase and rejects missing, duplicate or unknown ids. It emits steps in contract order, with each checkpoint anchored after a named phase.

2. **The pipeline observes real snapshot access.** Each phase runs with a typed `SnapshotHandle` over the top-level snapshot aggregates. Reads are recorded as the phase reads through the handle; `write` records the aggregate written; assigning `current` diffs against the pending view without recording reads. After the body returns, observed reads, writes and RNG use are checked against the phase's declared permissions. A violation reports `PHASE_ACCESS_DENIED` naming the phase, resource and direction, discards the phase's pending writes and stops the month (fail closed).

3. **Permissions are snapshot aggregates** (`nations`, `wars`, `designs`, `designFamilies`, `world`, `politics`, `strategicWeather`, …), not economic sub-resources. Treasury, fleets, construction projects and research live under `nations`.

4. **RNG enters through a grant.** `RandomGrant.seed()` and `RandomGrant.engine()` mark the phase as using randomness; a phase without `rng: true` fails closed when it uses either. This replaces the old self-declared `rngAllowed` flag.

5. **Battle resolution stops multitasking.** Presence measurement, foreign-station deployment and base limits become `presence_measurement`, `foreign_station_deployment` and `base_limits`, running after `battle_resolution` in that order. Deployment re-derives the presence demand from the same pure helper.

6. **Footprint duplication is deleted.** `PhaseRegistry`, `PhaseGuard`, `PhaseResource` and `PHASE_FOOTPRINTS` no longer exist; a `MonthPhase` carries its permissions and its deep body. Tests exercise phases through the pipeline interface.

7. **Phase bodies are deep implementations.** A phase receives the context and owns its logic; narrow phases read aggregate slices rather than spreading the whole snapshot. Phases whose work genuinely spans the snapshot declare `reads: "all"`.

8. **Event body types derive from their Effect schemas.** Each event body type is `Schema.Schema.Type<typeof <Kind>Schema>`; `DomainEventBody` derives from the union schema and `DomainEventEnvelope<TBody>` from the envelope schema's shell plus the generic body. No hand-mirrored interfaces remain. `parseDomainEventBody` and `parseDomainEventEnvelope` return the decoded schema type directly; the envelope parser is no longer generic. `eventType` is the literal union of the 24 body kinds. `SafeInt` decodes through `Schema.declare<SafeInt>`, matching the house pattern in combat. The `events` package depends on foundations only; `campaign` and `diagnostics` dependencies are removed.

9. **`@bluewave/events` is a layer-4 package.** Layer 4 already holds authoritative value packages; events is an authoritative contract package on the same foundation. `@bluewave/campaign-engine` may depend on `@bluewave/events` and carry `ExplanationTree` fields on its readout projections. The graph rule stays strict: every dependency still points to a strictly lower layer. The trees remain view-only and unhashed.

## Consequences

- An omitted read is no longer invisible: the month fails and names the phase, aggregate and direction. Adding or moving a phase is one edit to `TURN_PHASES` plus its implementation.
- The ordered phase list is asserted once, so order changes show up as one deliberate test diff rather than drifting across three declarations.
- No save, wire or ruleset field changes; `CURRENT_COMPATIBILITY_VERSION` and every golden are unchanged.
- Event body types cannot drift from their schemas; a schema change is a type change everywhere.
- A projection can carry an explanation tree built from the same output it exposes, without duplicating the contract or moving the calculation.
- The graph gate remains unbroken; no equal-layer edge is introduced.