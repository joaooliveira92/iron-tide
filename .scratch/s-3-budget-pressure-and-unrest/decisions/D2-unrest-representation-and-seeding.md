# D2: Unrest representation and seeding

**Type:** grilling · **Status:** resolved

## Question

How is unrest stored and seeded, given the manual gives no scale (p.62) and decision
request 0006 showed a required authored field blocks untouched production content?

## Answer

`NationState` carries a required integer unrest level inside declared bounds. The
compiler seeds it from an optional per-nation authored value; when content authors
none, the seed is the neutral lowest level, not a defaulted guess. Structure,
ledger, drivers and tests therefore land without touching production content.
Per-nation production seeds arrive in the production-values ticket, gated on 0010.
A compatibility-version bump covers the new state field.

## Why

A neutral floor is the same move as S-1 ticket 01's `ACTIVE` default: value-free
structure. Authoring seeded unrest is a balance choice the manual does not give, so
it is escalated, not invented (AGENTS.md stop conditions).
