# D-02: Scope boundary vs S-4 (Events and crises) and T-1 (Battle offer flow)

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Does this effort absorb the gameplay content of the unstarted `S-4 Events and
crises` and `T-1 Battle offer flow` sprints?

## Answer

**Substrate plus the minimum interruption mechanism.**

- **In scope:** the generic message/notification substrate, the minimum
  production-ready **decision** and **battle-interruption** mechanisms required to
  pause, persist, reload, and resume a turn, and the protocols/provenance plumbing.
- **Out of scope (stay in S-4/T-1):** authored crisis content, event catalogues,
  encounter-selection rules, and battle-offer gameplay policy.

(Locked round 1, option c.)

## Consequence

S-4 and T-1 remain separate efforts and are **blocked downstream** of the
interruption-seam delivery stage (M2), never absorbed into this effort. See the
map's "Seam contracts" and "Downstream dependency" sections, and D-08.
