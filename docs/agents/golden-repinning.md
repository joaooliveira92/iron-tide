# Golden repinning

`golden/hashes.json` records the authoritative hashes of the cross-process proof
(compile → execute a month → save/load → replay). It is the determinism gate's
baseline: a change to it means an authoritative outcome moved (BW-DET-003).

## Never edit it by hand

`scripts/regenerate-golden-hashes.cjs` is the single sanctioned way to update it.
It runs the cross-process child twice, asserts the two runs are byte-identical,
and only then atomically rewrites the file. A non-reproducible pair fails the
script rather than baking in a flaky hash. Never edit `golden/hashes.json` by
hand.

```sh
node scripts/regenerate-golden-hashes.cjs
node scripts/verify-golden-hashes.cjs   # verify (also runs in CI determinism.yml)
```

## Repinning is a deliberate act

When you re-pin a golden hash, the change must report the **old value, the new
value, the cause**, and a migration assessment — per the ENGINEERING-CONTRACT
(ADR-0007). `scripts/verify-golden-repin.mjs` guards that a change touching the
hash also states its reason, and reviewed exemptions name paths that cannot move
it. A golden that changes without an understood authoritative cause is a stop
condition (see `AGENTS.md`).

## Replay corpus approvals

Replay files in `golden/replays/` are not re-pinned. `golden/replay-approvals.json` holds
entries bound to the exact old and new checkpoint hashes of one replay and month (ADR-0246).
After `pnpm replay:record <id>`, run `pnpm replay:approve --cause "<why>" --migration
"<assessment>"` to propose entries from the diff against `origin/dev` (`--base <ref>`).
`pnpm check:replay-approvals` fails an unapproved, mismatched, orphaned, reused or rewritten
entry. CI only verifies; entries are append-only.

`pnpm check:replay-corpus` (in `pnpm check` and on three OSes in `determinism.yml`) verifies replays twice and via save/load, printing divergence.

New scenarios go in `scenarios.ts` with a one-line `purpose`; a new replay file is an addition and needs no approval. `pnpm replay:coverage` lists the subsystems each replay exercises and those none do.
