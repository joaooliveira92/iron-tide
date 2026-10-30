# Repository scripts

`scripts/` holds dependency-light Node scripts (`.mjs`/`.cjs`) that gate and
generate repository artefacts. Wired into a hook, `preflight`, `check`, or a
workflow.

## How they run

- **Git hooks** (`.githooks/`, installed by `prepare` → `install-hooks.mjs` →
  `core.hooksPath`): `pre-commit` blocks `dev`/`main` commits
  (`check-branch-discipline.mjs`, ADR-0165), format-checks staged files
  (`precommit-staged.mjs`), then `preflight`; `pre-push` adds `lint:effect`
  (ADR-0139); `commit-msg` checks the Conventional-Commit subject
  (`check-commit-msgs.cjs`; CI re-runs it in `commit-convention.yml`).
- **`pnpm preflight`** runs `vp run gates:preflight`, the `gate:*` DAG in
  `vite.config.ts` (ADR-0164).
- **`pnpm check`** runs `check:steps` under the `heavy.mjs` lock (ADR-0299): format, lint,
  `lint:effect`, `test:scripts`, typecheck, build, `content:verify`, tests, golden,
  determinism, re-pin and balance checks, and E2E.

## Gates (preflight)

Several gates run embedded `--self-test` fixtures first; the `gate:*` DAG in
`vite.config.ts` records which.

- `preflight.cjs` — fail fast on an in-progress merge/rebase or conflict markers.
- `assert-single-effect.mjs` — `effect` single-copy invariant.
- `assert-runtime-free.mjs` — runtime-free import boundary (ADR-0100/0128).
- `assert-authoritative-determinism.mjs` — no ambient time/RNG/env/filesystem enumeration in pure packages.
- `assert-tagged-errors.mjs` — every error class carries a `_tag` (`--scope engine|surface`).
- `assert-boundary-decode.mjs` — reject `JSON.parse(...) as T` (`--scope compiler|desktop|cli|persistence`).
- `assert-no-stage-io.mjs` — no `node:fs`/`node:child_process` in compiler stages.
- `assert-canonical-serialization.mjs` — no raw `JSON.stringify` in authoritative roots.
- `assert-no-library-console.mjs` — no `console.*` in library modules.
- `link-claude-skills.mjs` — recreate the `.claude/skills` → `.agents/skills` symlinks.
- `docs-check.cjs` — markdown links/anchors, ADR index/status/supersession, deferrals, DESIGN amendments.
- `verify-doc-budgets.mjs` — word ceilings in `doc-budgets.manifest.json` (`--list`).
- `verify-package-agents.mjs` — every package has an `AGENTS.md` (or an exemption) whose `Class` matches the runtime-free gate.
- `verify-package-dependencies.mjs` — dependency policy (no floating specs, `effect` `workspace:*`).
- `verify-no-unknown-casts.mjs` — ratchet against new `as unknown` casts.
- `verify-no-torpedo-model-constants.mjs` — no retired torpedo-model symbols in combat.
- `verify-no-upgradepath-refit-readers.mjs` — no `upgradePath`/`supersedes` in refit/production paths.
- `verify-test-focus.mjs` — no `.only`; `.skip` needs a `test-focus-allow-skip` note.
- `verify-version-coherence.mjs` — desktop version equals `CURRENT_COMPATIBILITY_VERSION` (ADR-0134).
- `verify-check-parity.mjs` — every `pnpm check:steps` step is CI-invoked or allowlisted (ADR-0140).
- `verify-reachability-ledger.mjs` — engine capability to desktop path ledger (ADR-0267; `--write` regenerates the report).
- `verify-tsgo-integration.mjs` — toolchain pins match the installed `@effect/tsgo` set and it is patched (ADR-0139).
- `verify-vitest-config-parity.mjs` — every package spreads `vitest-shared.mjs`.
- `verify-worktrees.mjs` — warn-only: drift reported by `pnpm worktrees audit`, run offline (ADR-0220).
- `verify-content-lock.mjs`, `verify-content-gate.mjs` — built content matches the lock; no shipping placeholders.
- `verify-codemod-determinism.mjs` — content codemod byte-identical and idempotent across processes.

## `pnpm check` extras (also CI)

- `license-check.cjs` (`check:licenses`) — deny strong-copyleft/source-available prod licences.
- `run-heavy-tests.mjs` (`test:heavy`) — heavy phase-engine suites, bounded workers.
- `verify-golden-hashes.cjs` (`check:golden`) — reference run matches `golden/hashes.json`.
- `verify-cross-process-determinism.cjs` (`check:determinism`) — child hash reports byte-identical.
- `verify-equivalence-determinism.mjs` (`check:equivalence`) — equivalence/part-build SHA-256 stable (SPM-R24).
- `verify-replay-corpus.mjs` (`check:replay-corpus`) — replays verified twice, identical output.
- `verify-golden-repin.mjs` (`check:golden-repin`) — authoritative edits re-pin golden or carry `Golden-Repin: not-needed`.
- `check-balance-reports.cjs` (`check:balance-reports`) — committed reports match the regenerated ones.

## Manual tools

- `adr-index.cjs` (`pnpm adr:index`) — regenerate the `docs/adr/` indexes.
- `change-scope.mjs` (`pnpm change-scope --base <ref>`) — change-scope JSON ([usage](../docs/agents/change-scope.md)).
- `agent-map.mjs`, `verify-affected.mjs`, `sprint-show.mjs` — agent loop ([agent tools](../docs/agents/agent-tools.md)).
- `worktree.mjs` (`pnpm worktrees …`) — manage worktrees, the registry, and task lifecycle state: `status`, `inbox` (ADR-0364, ADR-0367, [task lifecycle](../docs/agents/task-lifecycle.md)).
- `changelog.mjs` — draft a changelog section from Conventional Commits (ADR-0134).
- `install-hooks.mjs` (`pnpm hooks:install`) — point `core.hooksPath` at `.githooks`.
- `new-nation.mjs` — scaffold a nation's content ([adding a nation](../docs/agents/adding-a-nation.md)).
- `optimize-artwork.mjs` — regenerate downscaled AVIF card artwork (macOS `sips`).
- `sweep-comments.mjs` (`pnpm sweep:comments [--apply]`) — deterministic comment/banner sweep, dry-run.
- `vendor-effect-sync.mjs` (`[--verify]`) — regenerate/verify vendored Effect artifacts.
- `regenerate-golden-hashes.cjs` — re-bake `golden/hashes.json` ([golden repinning](../docs/agents/golden-repinning.md)).
- `release-signing-wizard.sh` — guided release signing ([desktop signing](../docs/delivery/desktop-signing.md)).

## Fixtures and support

`scripts/test/` (`pnpm test:scripts`, Node's test runner) covers the gates.
Tracked inputs: `doc-budgets.manifest.json`, `no-unknown-casts.baseline.json`,
`authoritative-determinism.baseline.json`, `golden-repin.baseline`,
`lib/doc-anchors.cjs`, `vitest-shared.mjs`.

New scripts (ADR-0106/0107): fail closed, own your fixtures, wire into a hook
or workflow — never leave it undocumented.
