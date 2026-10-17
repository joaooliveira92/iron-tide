# D-07: Pure, versioned notification policy

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Is the notification policy a pure, versioned total function with no ambient
randomness?

## Answer

**Yes.** The policy is
`(domainEvents, snapshot, projectionInputs) → TurnMessage[]` — deterministic and
**total**, carrying a declared `projectionVersion`. It uses canonical ordering,
stable grouping, and stable deduplication. **Forbidden:** ambient randomness,
current time, locale-dependent sorting, process state, renderer state. Any
genuinely random selection must use an existing **keyed deterministic stream** and
be represented in the replay ledger. Renderer dismissal never deletes an
authoritative event (D-15).

(Locked round 2, option a.)

## Consequence

Non-negotiable under the determinism invariant. Drives D-12 (identity/ordering),
D-11 (dedup/aggregate keys), D-18 (determinism tests).
