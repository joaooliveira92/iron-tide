# ADR-0226: RTW3 prestige research outcome — the model is grounded, the production values are not

Applies to: content, campaign

## Status

Superseded by: ADR-0354

Accepted (2026-10-17). Records the product of decision
[0003](../../.ai/decision-requests/0003-prestige-scale-and-values.md) (Option B,
research only), authorized by
[ADR-0225](ADR-0225-prestige-required-field-and-research-first.md). Sprints: S-2.

Gate lifted (2026-10-19) by [ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md), which resolves decision request 0012.

## Context

Decision 0003-B authorized research of the RTW3 prestige scale/bounds, per-nation
1880 starts, loss fractions by source, gain magnitudes by source, monthly sacking
probability, and the final-score rule against high-trust sources, recorded with
per-value citations and provenance classes. The research ran and is captured in
`docs/research/rtw3-prestige-values.md`. It grounded the prestige *model* but
almost none of the *numbers* S-2 needs, and it found one contradiction and several
absent values. Decision 0003-B forbids substituting a Bluewave calibration,
fixture value, placeholder, inferred value, or undocumented approximation.

## Decision

- **The 0003-B research is complete.** Its findings and per-value provenance
  classes are recorded in `docs/research/rtw3-prestige-values.md`.
- **Grounded model facts are recorded, not committed to production.** The
  research grounds: prestige is a plain integer per nation; a fresh campaign
  starts every nation at 20 (reverse-engineered observation); the sacking
  threshold is ≤16 and the risk is non-deterministic (documented RTW3); every
  loss/gain source exists and loss is "in most cases proportional" (documented
  RTW3); end-of-career prestige is the career "victory points" score saved to a
  Hall of Fame (documented RTW3). These are the implementation basis but are not
  themselves a production value set.
- **No production prestige value is adopted.** No scale bound, per-source loss
  fraction, gain magnitude, monthly sacking probability, final-score formula, or
  per-nation 1880 starting value is adequately grounded; the fresh-start 20/19
  discrepancy is unresolved. These are returned to the owner individually in
  decision request
  [0012](../../.ai/decision-requests/0012-prestige-values-unresolved-after-research.md).
- **No Bluewave calibration is substituted** for any ungrounded value.
- **S-2 ticket 08 remains blocked** on decision 0012. Production 1880 content
  stays untouched, and `NationState.prestige` stays required with no engine
  default (ADR-0225).

## Consequences

- S-2 (prestige and career) stays gated; the structural S-2 tickets remain
  specified against fixture-class constants that never ship in production.
- When the owner decides 0012, the production values land in one movement (one
  golden/save re-pin), and `NationState` gains the required prestige field under
  a compatibility bump with a deterministic migration or a deliberate refusal of
  incompatible prior saves (ADR-0225).
- The research note explicitly marks its sources as non-exhaustive (the NWS
  official forum search and general web search were partially inaccessible), so a
  later higher-trust pass can supersede it without re-litigating this record.
