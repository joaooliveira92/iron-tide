# D7: Economy: growth, colonies, research cap

**Type:** grilling · **Status:** resolved

## Question

How do the manual's three economy statements (pp.12-13, 16) become rules?

## Answer

- **Growth:** base resources grow at an annual rate in the manual's 3-5% band,
  applied by a monthly phase before revenue with integer compounding and explicit
  rounding. The band edges are rules; each nation's rate within it is a value (0010).
- **Colonies:** each possession carries an optional value; colony income is the sum of
  possession values scaled by a decay factor that falls with elapsed campaign time and
  is added to appropriation. Absent values add nothing, so structure lands neutrally.
- **Research cap:** the standing research budget may not exceed 12% of the nation's
  naval budget (hard rule); returns diminish above 10% by a ruleset-constant curve.

## Why

Growth and the cap carry manual numbers, so they are rules; the curve, decay and
per-nation figures are not given and are ruleset constants with recorded provenance,
as ADR-0223 does for S-1. These three change revenue and research outcomes, so the
reference run moves and needs the golden re-pin path
(`docs/agents/golden-repinning.md`).
