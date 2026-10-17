# 04: Phase-engine interruption seam and deterministic resume

**What to build:** The minimum additive change to the monthly pipeline that lets a turn pause for a mandatory decision or a battle and later resume. `MonthResult` gains a new optional suspended outcome and an input channel; the channel is not a phase resource, draws no randomness, and never repurposes the existing success flag. A generic decision seam and a generic battle seam consume recorded external inputs: a present, hash-valid input is applied and resolution continues; an absent one suspends the turn. Resume re-executes the month from the authoritative pre-turn snapshot with the accumulated inputs — no engine object, ledger, guard, closure, or partial snapshot is ever serialized. A player-resolved battle is applied exactly once and never re-rolled.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A month with no interruptions produces a byte-identical result to today (goldens unchanged).
- [ ] Recorded inputs are consumed strictly in deterministic ordinal order; extra, missing, or hash-mismatched inputs suspend with an error, never a guess.
- [ ] Re-executing a suspended turn from the same pre-turn snapshot and inputs is bit-identical.
- [ ] A resumed turn's final authoritative hash equals the uninterrupted single-run hash.
- [ ] A recorded battle result is applied exactly once and the resolver never re-rolls it.
- [ ] No live engine object is serialized; the phase registry/footprint contract and the frozen event wire format are untouched.
