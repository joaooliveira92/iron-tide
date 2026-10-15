# Validation Report: <milestone>

## Outcome

`PASS`, `PASS_WITH_LIMITATIONS`, or `BLOCKED`.

## Scope delivered

Summarize implemented behavior and explicitly deferred behavior.

## Requirements evidence

For each requirement, list implementation symbols and proving tests.

## Commands and observed results

```text
<exact command>
<exit status and concise observed result>
```

Do not claim commands that were not executed.

## Determinism evidence

- Content artifact hash:
- Initial snapshot hash:
- Closing snapshot hash:
- Command ledger hash:
- Event ledger hash:
- Financial ledger hash:
- Random-decision ledger hash:
- Replay result:
- Processes and operating systems used:

Mark unavailable evidence as unavailable, not passed.

## Canonical artifact changes

For every change: old hash, new hash, cause, version impact, compatibility, migration, and regeneration command.

## Tests added

List unit, invariant, property, metamorphic, fixture, save/load, replay, cancellation, security, architecture, and smoke tests.

## Security and cancellation

Describe trust boundaries, parsing and path defenses, temporary output behavior, abort points, and cleanup evidence.

## Performance observations

Report non-authoritative fixture measurements and regressions, if collected.

## ADRs and dependencies

List new ADRs and dependencies with rationale, license, maintenance, security, and determinism assessment.

## Known limitations and deferred requirements

Be precise. Do not present fixture support as production support.

## Changed files

Group by package and purpose.

## Git and remote status

- Branch:
- Commits:
- Working tree:
- Push status:
- Pull request:
- Merge performed: must be `no`

## Secondary consistency check

Record the independent recheck of hashes, generated outputs, diagnostic order, final paths, and Git cleanliness.
