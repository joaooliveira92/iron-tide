# D-05: Resumable turn model — deterministic re-execution with recorded inputs

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

How does a turn pause and resume: serialize a checkpoint, or re-execute?

## Answer

**Deterministic re-execution with recorded external inputs.**

- A suspended turn is resumed by **re-executing the month from the authoritative
  pre-turn snapshot** with the accumulated recorded inputs.
- **Never serialize** `MonthContext`, phase-local objects, partial snapshots,
  closures, ledgers, guards, or continuations.
- The brief's "must not rerun completed phases" is an **exactly-once effects**
  guarantee, **not** a prohibition against recomputation. No effect may be applied
  twice to authoritative state.
- Phase-boundary memoization is a **later performance optimization only**.

(Locked round 2, option a.)

## Rationale

Reuses the proven determinism/replay machinery (`ReplayVerifier`,
`month-input.json`); no live engine object becomes a frozen format; an imported
battle result is naturally an external input.

## Consequence

Drives D-10 (pending-turn record), D-12 (input identity/consumption), D-17
(additive `suspended` seam), D-18 (re-execution parity tests). Validated by R-20.
