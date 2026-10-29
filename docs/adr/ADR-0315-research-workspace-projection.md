# ADR-0315: The research screen reads a technology-chart projection, and the draw weight has one home

Applies to: campaign, desktop

## Status

Superseded by: ADR-0340

Accepted (2026-10-23).

## Context

The research screen showed the budget and 15 field weights but nothing the engine does with them. The
engine splits the budget across fields that have an open technology, draws one technology per field by
discovery weight, and discovers it when its points reach its cost. A player who set a High priority on a
field with nothing open silently sent the whole budget elsewhere, and the screen projected points over
all 15 fields, which the engine never does.

The desktop renderer imports no engine, so everything the screen needs must arrive in the projection.
The historical timing modifier on the draw weight lived as a private function in `phase-engine`.

## Decision

- `ResearchScreenProjection` carries `technologies` (status, cost, invested points, prerequisites, what
  is missing, availability, discovery weight, timing modifier, draw weight, draw odds), `fields`
  (eligibility, totals, active candidate), `turnNumber`, and the low-spending flag with its floor.
- Technology status is derived once, in `campaign-engine`, from the same eligibility functions the month
  phase uses: `discovered`, `researching`, `open`, `locked` (prerequisites missing), `future`.
- `historicalTimingModifierBp` and `discoveryDrawWeight` move to `@bluewave/campaign` beside the
  eligibility rules. `phase-engine` and the projection both call them. Behaviour is unchanged; every
  golden hash still matches.
- Authored technology names come from the content artifact in `main` and are passed into the projection
  builder, which stays pure. The renderer falls back to a humanised id.
- The renderer projects points over eligible fields only, matching the engine's largest-remainder split.
- The screen is a workspace in the shipbuilding idiom: a field map, a technology chart, and an
  inspector with a status bar. It reuses the shipbuilding `Inspector` and `EngineeringStatusBar`.

## Consequences

- The projection grows. It is non-authoritative and read-only, so no save or wire-schema parity applies.
- Draw odds shown to the player are the engine's own weights, not an estimate that can drift.
- Exact technology selection stays prohibited (`EXACT_TECHNOLOGY_SELECTION_PROHIBITED`); the UI steers
  fields and shows odds, never a technology picker.
- `RESEARCH_SPEED` multipliers are defined in `@bluewave/campaign` but not applied by the research phase,
  so the screen does not show them.
