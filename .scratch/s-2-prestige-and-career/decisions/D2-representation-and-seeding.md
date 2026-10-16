# D2: Representation and seeding

**Type:** grilling · **Status:** resolved

## Question

How is prestige represented and where does its starting value come from?

## Answer

A required branded safe-integer field on every nation's state (ADR-0202: integer
canonical values, checked arithmetic). Starting values are authored per nation in
1880 content and validated at the compile boundary; there is no engine default.
The new field changes authoritative hashes, so it ships under a compatibility-
version bump (saves from other versions are refused, never migrated, per
`CONTEXT.md`). The hash change has an understood cause and is re-pinned per
`docs/agents/golden-repinning.md`, not worked around with an absent-until-set
optional field.

## Why

Optional fields exist in this codebase to avoid perturbing old save hashes, but
prestige must exist for every nation from month one and be seeded, so an optional
field would only hide a gap. Per-nation, not player-only, because AI (A-1) and
events (S-4) need it.
