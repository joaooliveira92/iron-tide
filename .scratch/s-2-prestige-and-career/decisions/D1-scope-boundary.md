# D1: Scope boundary

**Type:** grilling · **Status:** resolved

## Question

Which prestige sources does S-2 own, given most manual sources depend on
systems that do not exist yet?

## Answer

S-2 owns the mechanism (state, ledger, proportional loss, sacking, career
result, projection) plus only the sources whose triggering state already exists
in the engine: **unpaid funds** (negative-treasury obligation, manual p.13) and
**war and battle outcomes** (war ended, battle lost, capital ship lost; manual
pp.12, 59, 62). Sources that need unbuilt systems (events, presence, declined
battles, trade protection, officer costs) are not stubbed with fake triggers;
each later sprint calls the same seam (D3).

## Why

The sprint-plan gate says a capability counts only when a deterministic test
drives it from a compiled campaign month. A source with no real trigger cannot
pass that gate, so it belongs to the sprint that builds the trigger.
