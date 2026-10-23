# ADR-0279: Replay approvals carry a verified change class

## Status

Accepted (2026-10-23). Amends ADR-0246 (its approval entry shape; the hash binding, append-only rule and CI-only-verifies rule are unchanged).

## Context

An approval records a free-text cause and migration assessment. A reviewer cannot tell from the file whether a moved checkpoint is a deliberate gameplay change, a ruleset bump, or an encoding change, and an encoding change is the one most likely to be waved through because nothing visible should have changed.

## Decision

1. The approvals file moves to `replay-approvals/2`. Each entry has a required `changeClass`: `EXPECTED_GAMEPLAY_CHANGE`, `SERIALIZATION_ONLY` or `RULESET_VERSION_CHANGE`. Unexpected nondeterminism is not a class: it is a failure and is never approved.
2. `propose` requires `--class`. An unknown class is refused.
3. `check` verifies a claim against the replay files themselves and reports `ClassMismatch` otherwise. `RULESET_VERSION_CHANGE` requires the replay's `rulesetVersion` to differ between base and head. `SERIALIZATION_ONLY` requires the ruleset version, compatibility version and content hash to be unchanged and every ledger of that month to keep its entry count. This is a necessary condition, not proof that nothing semantic moved.
4. Version 1 is read only when it has no entries, which is the state of the committed file. A version 1 file with entries is rejected, so no entry can enter without a class.

## Consequences

- The committed file changes its schema string only; no entry is rewritten.
- A reviewer reads the class first and the checker has already refuted the cheap false claims.
- A semantic change that keeps ledger counts and versions fixed can still be mislabelled `SERIALIZATION_ONLY`; the free-text cause and review remain the control for that case.
