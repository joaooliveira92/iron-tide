# D4: Strikes act as a budget brake

**Type:** grilling · **Status:** resolved

## Question

How does unrest "act as a brake on the naval budget" and produce "strikes and demands
for lowered military budget" (p.62)?

## Answer

When unrest is at or above the strike threshold the nation's naval appropriation
rate is lowered by a ruleset step per month the condition holds, never below the
existing lower bound, each reduction recorded as an event with a strike reason. The
player may raise the rate again by command within existing bounds; doing so feeds the
spending driver, closing the loop the manual describes. The same rule applies to AI
nations; AI goal-seeking is A-1.

## Why

Reuses the existing appropriation rate and its bounds, so no new budget channel is
created. Symmetric player/AI behaviour keeps the world consistent.
