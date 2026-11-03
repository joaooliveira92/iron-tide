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
value, the cause**, and a migration assessment — per the ENGINEERING-CONTRACT. `scripts/verify-golden-repin.mjs` guards that a change touching the
hash also states its reason, and reviewed exemptions name paths that cannot move
it. A golden that changes without an understood authoritative cause is a stop
condition (see `AGENTS.md`).

## Replay corpus replays are not re-pinned

Replays in `golden/replays/` never use the `Golden-Repin` trailer or `scripts/golden-repin.baseline`.
Their intended changes go through hash-bound approvals: see [replay corpus](replay-corpus.md).
This doc covers `golden/hashes.json` only, which stays as a smoke test.
