# Replay corpus

Replay files in `golden/replays/` are the determinism baseline (ADR-0246). They are not re-pinned:
the `Golden-Repin` trailer and the ratchet baseline do not apply to them
(see [golden repinning](golden-repinning.md)).

## Approvals

`golden/replay-approvals.json` holds entries bound to the exact old and new checkpoint hashes of one
replay and month. After `pnpm replay:record <id>`, run `pnpm replay:approve --cause "<why>" --migration
"<assessment>" --class <class>` to propose entries from the diff against `origin/dev` (`--base <ref>`);
the class (ADR-0279) is `EXPECTED_GAMEPLAY_CHANGE`, `SERIALIZATION_ONLY` or `RULESET_VERSION_CHANGE`.
`pnpm check:replay-approvals` fails an unapproved, mismatched, orphaned, reused, rewritten or misclassed
entry. CI only verifies; entries are append-only.

## Verifying and extending

`pnpm check:replay-corpus` (in `pnpm check`; three OSes in `determinism.yml`) verifies replays twice and via save/load, printing divergence.

New scenarios go in `scenarios.ts` with a one-line `purpose`; a new replay file needs no approval. `pnpm replay:coverage` lists the subsystems each replay exercises, and those none do.

Fuzz cases (`FUZZ_CASES`, pinned in `golden/replay-fuzz.json`) run on three OSes. A failure prints its seed; reproduce with `pnpm replay:fuzz run <seed> <months>`. Only `pnpm replay:fuzz record` (local, refused under CI) rewrites the pin; approvals do not cover it. Each fuzzed month also passes `invariants.ts`. Generated plans: ADR-0280.

## Retiring a legacy probe

A probe pinned in `golden/hashes.json` may be retired once a corpus mutation test catches the same
class of break. `golden/probe-retirement.json` classifies every pinned probe: it either cites the
mutation test (file and exact title) in `replay-corpus.test.ts`, or states why none exists.
`pnpm check:probe-retirement` fails on an unclassified probe or a missing cited test, and lists retire-eligible probes. It never removes anything: retiring a probe is a separate, reviewed change
that updates the register, the guards that read it, and this doc. The golden file stays until every probe is retired.
