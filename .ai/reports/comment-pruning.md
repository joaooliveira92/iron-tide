# Validation Report: comment-pruning & comment-shaped workarounds

## Outcome

`PASS` (with one gate unavailable — see below).

## Scope delivered

Frontier tickets **01–06 and 08–10** of `.scratch/comment-pruning` are delivered:
remaining low-value comments pruned (combat; engine/content/campaign;
ship-build/support; apps/scripts), remaining lint suppressions justified, dead
`void`-suppressed variables removed, unjustified `as unknown as` casts dissolved
via SafeInt unification in AI planning, coastline map paths given stable keys,
and the commands dead branch / stale comment resolved.

Deferred: ticket **07** (replace unjustified `as unknown as` double casts) stays
`blocked` — its sound remedy is a design change (strict `DesignDraft`/`EditLog`
schema decode edge + typed override merge), as recorded in its notes. Ticket
**11** (canonical naval penetration model) was already resolved as a deferral.

## Requirements evidence

- 01 combat comments — `packages/combat/src/**`, `packages/combat/test/**`.
- 02 engine/content/campaign comments — `packages/phase-engine/**`,
  `packages/campaign/**`.
- 03 ship-build/support comments — `packages/ship-design/src/**`,
  `packages/cross-process-test/**`.
- 04 apps/scripts comments — `apps/desktop/src/main/commands/**`,
  `NationSelectionScreen.tsx`.
- 05 lint-suppression reasons — `monthAdvance.perf.test.ts`,
  `combatDiagnostics.test.ts`, `snapshotClone.ts`.
- 06 dead `void`-suppressed vars — `construction.ts`, `partCatalogue.ts`,
  `stability.ts`, `suggest.ts`, `test/compile.test.ts`.
- 08 SafeInt unification — `packages/ai/src/{aiCommandGenerator,aiPlanner}.ts`,
  `scripts/no-unknown-casts.baseline.json`.
- 09 stable coastline ids — `VariantCGraph.tsx`.
- 10 commands dead branch / stale comment — `settlement.ts`, `specRules.ts`.

## Commands and observed results

```text
vp fmt --check .                         -> All matched files use the correct format.
vp lint .                                -> Found 0 warnings and 0 errors.
vp run -r build                          -> exit 0 (all packages built)
vp run -r typecheck                      -> exit 0
vp run -r --concurrency-limit 4 test     -> 2053 passed | 1 skipped (295 files)
node scripts/verify-no-unknown-casts.mjs -> no new assertions; 276 existing remain
node scripts/verify-cross-process-determinism.cjs -> two runs byte-identical
node scripts/verify-tracker-consistency.mjs       -> 0 error(s), 0 warning(s)
node scripts/verify-golden-hashes.cjs    -> UNAVAILABLE: golden/hashes.json absent
```

Pre-commit `gates:preflight` ran on every commit and passed (branch-discipline,
determinism self-tests, content lock, runtime-free, boundary-decode, single-effect,
codemod determinism, docs budgets, package dependencies).

## Determinism evidence

- Cross-process determinism: two fresh processes byte-identical.
- Codemod determinism: two fresh processes byte-identical (tree sha256
  `77ff063f78c07947bd49f80f768bd0206968679785c729b42ac87f36f884b995`).
- Golden hashes: unavailable (`golden/hashes.json` not present in this checkout).
- No authoritative-outcome changes are expected or introduced by this effort.

## Canonical artifact changes

None. Content lock unchanged (`8884200f…`). No golden hash change.

## Tests added

None. This effort only removes comments and dead/suppressed code; the existing
suite is the regression evidence. Test count unchanged (2053 passed).

## Security and cancellation

No trust boundaries changed. No new parsing, path handling, or abort points.

## Performance observations

Not collected (no behavioural change).

## ADRs and dependencies

None. No new dependency; ticket 07's proposed `effect`/`Schema` edge to
`ship-design` is deferred with it.

## Known limitations and deferred requirements

- Ticket 07 remains blocked (design-level strict-decode + typed-merge decision).
- Golden verify could not run because `golden/hashes.json` is absent from this
  checkout — marked unavailable, not passed.

## Changed files

- `packages/combat/**`, `packages/phase-engine/**`, `packages/campaign/**`,
  `packages/ship-design/**`, `packages/cross-process-test/**`, `packages/ai/**`,
  `packages/commands/**` — comment pruning and workaround dissolution.
- `apps/desktop/**`, `apps/compiler-cli/test/**`, `scripts/no-unknown-casts.baseline.json`.
- `.scratch/comment-pruning/{spec.md,issues/**}` — ticket restructure + resolutions.

## Git and remote status

- Branch: `master` (local-only checkout; no `dev` branch and no remote present).
- Commits: `bb567e2`, `bd4598d`, `2b36888`, `63a50c6`, `a811319`, `9d24323`,
  `eadb849`, `84426af`, `6c52aec`, `c167449`.
- Working tree: clean.
- Push status: not pushed (no remote configured).
- Pull request: none.
- Merge performed: no.

## Secondary consistency check

Re-read the tickets, spec, and every diff after the gate; confirmed the ticket
statuses match the delivered code, the tracker-consistency gate is green, and the
tree is clean at HEAD.
