# ADR-0240: S-3 unrest and economy values are researched then tunable; government type derives from political system

Applies to: content, campaign

## Status

Accepted (2026-10-19). Resolves decision requests
[0010](../../.ai/decision-requests/0010-s-3-unrest-economy-values.md) (Option A) and
[0011](../../.ai/decision-requests/0011-s-3-government-type-classification.md)
(Option A), decided by the owner's delegation. Sprints: S-3. Follows
[ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md): S-3 depends on S-2.

## Context

S-3 (budget pressure and unrest) needs numbers the manual does not give, and a
classification of 1880 nations by government type. The manual states only growth of
about 3 to 5% a year (p.12), diminishing research returns above 10% with a 12% cap
(p.16), and qualitative unrest rules (p.62). Revolution is "less likely in liberal
democracies" (p.62), but the manual lists six government types (p.60) without
classifying any 1880 nation. Inventing either would fabricate canonical gameplay.

## Decision

**Values (0010, Option A: research first, then tunable constants).**

- S-3 ticket 14 begins with a research note, `docs/research/rtw3-unrest-economy-values.md`,
  that grounds what the manual, patch notes, saves and history allow, with the
  provenance classes the prestige note uses. The grounded rules (3 to 5% growth, the
  10% and 12% research curve, the p.62 drivers and brakes) are binding as stated.
- Every remaining number (the unrest scale and seeded 1880 levels, strike and
  revolution thresholds, driver magnitudes, harsh-peace severity, per-nation growth
  within 3 to 5%, possession values and decay, the research-return curve) is a named
  centralized ruleset constant (ADR-0223 form), recorded as an ADR-0213
  `balance_adjustment` with `sourceStatus: BALANCE_TARGET` and a rationale. None is
  presented as sourced. The "matches RTW3" constraint is waived for those values only.
- Values are chosen so the model is playable, not punishing: unrest should be
  reachable by sustained budget pressure and never by one bad month, mirroring the
  recoverable shape ADR-0239 gives prestige.
- The one-time reference-run change S-3 causes (growth, colony income, research
  caps) is approved, with a compatibility bump and a same-commit re-pin that states
  its cause (`docs/agents/golden-repinning.md`).

**Government type (0011, Option A: derive from political system).**

- A single ruleset table maps each authored `politicalSystem` to one of the manual's
  six government types. No second per-nation content field is added; there is one
  source of truth.
- The only classification that changes revolution odds is _liberal democracy_, which
  damps revolution. A nation is a liberal democracy only if, in 1880 practice, its
  executive is answerable to an elected legislature. Formal titles alone do not decide.
- **Tie-break:** a nation the research cannot place with confidence is _not_ a
  liberal democracy. Doubt never silently damps revolution; it leaves the risk at its
  default.
- Every nation must classify or content compilation fails with the no-default
  diagnostic ticket 09 already carries.
- Ticket 14's research note justifies each borderline nation (for example the limited
  franchises of the Italian and Iberian monarchies, and the German and Austro-Hungarian
  constitutions) and the table is reviewed there. This ADR fixes the rule and the
  tie-break, not the table.

## Consequences

- S-3 tickets 01 to 13 keep their fixture constants; ticket 14 authors production
  values and the table, citing this ADR and its research note for provenance.
- The table is part of ticket 14's single re-pin, with no separate content migration.
- Retuning any balance value is a ruleset version change, not a model change.
- If a higher-trust source appears for any item, the grounded value replaces the
  balance value and this ADR is amended.
