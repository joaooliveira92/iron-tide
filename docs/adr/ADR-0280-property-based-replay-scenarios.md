# ADR-0280: Property-based replay scenarios use fast-check as a test-only dependency

Applies to: cross-process-test

## Status

Superseded by: ADR-0366

Accepted (2026-10-23). Builds on ADR-0246 and does not amend it: the pinned fuzz seeds stay as the cross-OS equality baseline.

## Context

The fuzz cases pinned in `golden/replay-fuzz.json` replay a fixed list of seeds. They catch regressions but do not search, and a failure names a seed rather than a minimal command sequence. The repository's other property test (`economy-ledger.property.test.ts`) hand-rolls a generator and has no shrinking.

## Decision

1. `fast-check` (MIT, one dependency, `pure-rand`, MIT) is a devDependency of `@bluewave/cross-process-test` only. No authoritative package, no runtime-free package, and no app imports it.
2. A scenario is a `CommandPlan`: a list of months, each a list of `CommandPick` values (a command kind and integer draws scaled by `PICK_SCALE`). `planCommands` builds the same command bodies as the seeded fuzz through one shared constructor, so both paths issue identical commands for identical draws.
3. Property tests always pass an explicit `seed` and `numRuns` to `fast-check`, so a run is reproducible and its runtime does not depend on the clock.
4. Each generated plan must be repeatable, survive save/load every month, and satisfy the snapshot and ledger invariants.
5. The harness is itself mutation-checked: an injected extra random draw must fail the properties and shrink to the minimal plan.

## Consequences

- Failures print a shrunk plan and the `fast-check` seed. A discovered counterexample is promoted by adding the plan to the test as a permanent case.
- The pinned fuzz digests are unchanged by the shared constructor.
- A new dev dependency enters the lockfile. It does not reach the desktop bundle.
