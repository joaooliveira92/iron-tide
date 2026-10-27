# ADR-0225: Prestige is a required authored field; values are research-first and S-2 is gated on 0003

Applies to: content, campaign, persistence

## Status

Accepted (2026-10-17). Resolves decision requests
[0006](../../.ai/decision-requests/0006-prestige-required-field-vs-untouched-production.md)
(Option B) and
[0003](../../.ai/decision-requests/0003-prestige-scale-and-values.md)
(Option B). Sprints: S-2.

Gate lifted (2026-10-19) by [ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md), which resolves decision request 0012.

## Context

S-2 must seed prestige per nation in 1880, apply proportional loss, sack the
player at or below a threshold, and report a final score. The manual gives the
rules but none of the numbers, so the scale and every magnitude were escalated in
decision request 0003. S-2's map decision D2 fixes `NationState.prestige` as a
**required** field with no engine default, authored per nation in 1880 content.

That creates a conflict: the production-pack loop compiles
`content/production/1880` and would fail on a required but unauthored field,
while authoring a production value before the scale is resolved would fabricate
canonical gameplay. Decision request 0006 asked how to resolve it. The owner
chose to keep the field required and gate S-2 on the 0003 research rather than
ship a disposable placeholder, avoiding a double golden/save movement (once for
a placeholder, again for the researched value).

## Decision

- **`NationState.prestige` remains required with no engine default.** It is not
  optional, nullable, silently defaulted, or derived from an unrelated field.
- **No placeholder, fixture-class, or otherwise unsourced prestige value enters
  production content.** Production 1880 content stays untouched until the
  production value set is authorized.
- **S-2 implementation is gated on decision 0003.** S-2 tickets 01–09 stay
  blocked until 0003 is fully resolved and the production values are authorized.
- **0003 authorizes research only** (Option B): research the prestige scale and
  bounds, per-nation 1880 starts, loss fractions by source, gain magnitudes by
  source, monthly sacking probability, and the final-score rule against
  high-trust external sources; record every adopted value with a citation in
  `docs/research/` and the required ADR; return every unresolved or contradictory
  value to the owner individually.
- **Provenance classes are explicit.** Research must distinguish directly
  documented RTW3 behaviour from historical analogues, community observations,
  reverse-engineered observations, and Bluewave balance decisions. No production
  prestige value may be committed until its provenance is explicit. No Bluewave
  calibration, fixture value, placeholder, inferred value, or undocumented
  approximation is substituted.

## Consequences

- S-2 stays blocked until the 0003 research produces adequately sourced rules and
  any residue is decided by the owner; the structural S-2 tickets remain
  specified against fixture-class constants that never ship in production.
- There is no disposable prestige placeholder, so the golden/save movement
  happens once, when the researched production values land.
- When S-2 lands, `NationState` gains the required prestige field under a
  compatibility bump, with a deterministic migration or a deliberate refusal of
  incompatible prior saves, and the production anti-vacuity floor stays at ten
  playable nations (ADR-0214).
