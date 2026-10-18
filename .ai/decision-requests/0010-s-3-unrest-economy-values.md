# Decision Request: S-3 unrest and economy values, and the reference-run change

## Status

Blocked pending owner decision. Gates S-3 ticket 14 only; tickets 01-13 proceed on
fixture-class values.

## Trigger

S-3 (`.scratch/s-3-budget-pressure-and-unrest/`) needs numbers the manual does not
give. It states three: growth about 3-5% a year (p.12), diminishing research returns
above 10% and a 12% cap (p.16). It gives only qualitative rules for unrest (p.62) and
colony income "decreasing over time" (p.13). Missing: the unrest scale and seeded 1880
levels, strike and revolution thresholds, driver magnitudes, strike step, revolution
probability and liberal-democracy damping, harsh-peace severity, per-nation growth
within 3-5%, possession values and decay, and the research-return curve. S-3 also moves
the cross-process reference hashes (growth, colony income, research caps).

## Evidence

- Manual pp.12-13, 16, 62, 70, 77-78; `docs/research/rtw3-manual-baseline.md`.
- Precedent: ADR-0223 (tunable ruleset constants with provenance) and ADR-0225
  (research first, production gated).
- A baseline exists (`golden/hashes.json`), so a same-commit re-pin is possible.

## Why agent judgment is insufficient

Each value changes authoritative outcomes: too low and unrest never bites, too high
and the game is unwinnable. Inventing them would fabricate canonical gameplay
(AGENTS.md stop conditions).

## Options

### Option A: Research first, then tunable constants (recommended)

- Behavior: a research note grounds what history allows; the rest are centralised
  ruleset constants marked as balance choices, as in ADR-0223.
- Advantages: honest provenance; balance tunable without code changes.
- Risks: some values remain judgment calls.
- Compatibility impact: one compatibility bump and one re-pin in ticket 14.
- Migration impact: none to saves beyond the new fields.
- Scope and effort: one research note plus ticket 14.

### Option B: Owner supplies the numbers

- Behavior: the owner provides the table; ticket 14 transcribes it.
- Advantages: fastest.
- Risks: owner effort; provenance notes still needed.
- Compatibility and migration impact: same as Option A.

## Recommendation

Option A. It matches the owner's choice for S-1 (ADR-0223) and keeps every number
isolated. Approve the one-time reference-run change for S-3 together with it.

## Work safely completed while blocked

Map, spec and tickets 01-13 with fixture constants; no production value authored.
