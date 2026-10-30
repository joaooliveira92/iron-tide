# ADR-0223: S-1 readiness, crew and maintenance values are centralized ruleset constants

Applies to: content, campaign, phase-engine

## Status

Superseded by: ADR-0355

Accepted (2026-10-17). Resolves decision request
[0007](../../.ai/decision-requests/0007-s-1-readiness-crew-and-maintenance-values.md)
(Option A). Sprints: S-1.

## Context

S-1 gives every commissioned ship a readiness state (`ACTIVE`/`RESERVE`/
`MOTHBALLED`/`WORKING_UP`/`REPAIR`) and a crew quality, charges monthly
maintenance by state, costs repair at about twice active, raises wartime
maintenance, and excludes working-up ships from battle. The manual states the
rules but almost none of the numbers: the absolute active rate, the reserve and
mothballed multipliers, the wartime multiplier, the per-state crew ceilings and
ramp, the working-up threshold, and the battle readiness value are absent.
Today those quantities are literals scattered across the code — `floor(hitPoints
* 10 / 100)` in `packages/phase-engine/src/economyPhases.ts`, a duplicated copy
in `packages/campaign-engine/src/{opening-briefing,projection}.ts`, the neutral
crew band `AUTO_TORPEDO_CREW_QUALITY_BP`, and a hard-coded battle readiness of
`80` in `packages/phase-engine/src/battlePhases.ts`.

Decision request 0007 escalated the values; the owner chose Option A: research
what can be grounded, and isolate every number as a tunable constant.

## Decision

- **Grounded rules are preserved as given:** repair costs approximately twice
  active maintenance and mothballing halts repair and its premium (manual p.51);
  mothballed maintenance is half (`mothballedMaintenancePerMonthMicro` /
  `preservationCostBp`); the `AF`/`RF`/`MB`/`WU` states remain distinct; and
  working-up ships cannot fight.
- **Every numeric gameplay value is a named, centralized ruleset constant with
  provenance.** No numeric gameplay constant may be embedded directly in
  `economyPhases.ts`, `battlePhases.ts`, `opening-briefing`, `projection`, or
  `torpedoProjection.ts`.
- **The hard-coded battle-readiness value `80` is removed** and read through the
  centralized ruleset mechanism.
- **Maintenance, readiness, projection and opening-briefing consume the same
  authoritative constants**, so the three current maintenance copies cannot
  diverge.
- **Values are grounded by high-trust research where possible**; any value that
  cannot be grounded may be selected only as an explicitly labelled ADR-0213
  `balance_adjustment` (with `sourceStatus: BALANCE_TARGET`), covered by
  deterministic tests and designed for later tuning. Values the sources omit are
  never presented as sourced facts.
- **Goldens are re-pinned only when observable deterministic output actually
  changes**, using the established same-commit procedure
  (`docs/agents/golden-repinning.md`).

## Consequences

- S-1's production values have one home; retuning changes constants, not the
  model or the phase code.
- The maintenance/readiness seam is single-sourced across the phase, the opening
  briefing and the projection.
- The snapshot gains readiness/crew state under the S-1 compatibility bump; any
  month whose maintenance, treasury or crew output changes moves the reference
  golden, re-pinned with an understood cause.
- If research cannot ground a value and it cannot be responsibly classified as an
  ADR-0213 balance adjustment, that individual value returns to the owner rather
  than being guessed.
