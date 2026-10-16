# D3: Loss and gain rule

**Type:** grilling · **Status:** resolved

## Question

What is the shape of a prestige change, given the manual says loss is
"in most cases proportional"?

## Answer

Every change goes through one seam that takes nation, source reason code, and
either a proportional loss (basis points of current prestige) or a fixed gain, and
writes a domain event recording the reason, before and after, and the ruleset
version. Proportional loss uses integer basis-point arithmetic with an explicit
rounding rule and a floor of zero; fixed amounts are bounded. Prestige never
leaves its declared bounds. The numeric rates are ruleset constants (D6).

## Why

One seam keeps S-3/S-4/T-1/W-1/W-6 from each inventing arithmetic, and makes
every source auditable by reason code (AGENTS.md determinism).
