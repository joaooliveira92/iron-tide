# D-12: Interruption identity, ordering, and input-consumption semantics

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

How are interruptions identified, ordered, and matched to recorded inputs?

## Answer

- `turnId = H(campaignId, startingRevision, committedOrderHash, orderedInputsHash)`
- `interruptionId = H(turnId, phase, ordinal, subjectKey)`, where `ordinal` is
  assigned in **deterministic emission order**.
- Recorded inputs are consumed **strictly by ordinal**: at an interruption point
  the resolver looks for a recorded input at the next ordinal — present and
  hash-valid → apply and continue; absent → emit the request and suspend.
- Extra, missing, or hash-mismatched inputs are a **suspension error, never a
  guess**.

(Locked round 3.)

## Rationale

Makes pause/resume bit-identical under re-execution and gives each interruption a
stable identity for persistence, IPC, and history.

## Consequence

Consumed by D-05, D-10, D-14. Grounded by R-20.
