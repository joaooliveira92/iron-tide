# Repository scripts

`scripts/` holds dependency-light Node scripts (`.mjs`/`.cjs`) that gate and
generate repository artefacts.

## How they run

- **Git hooks** (`.githooks/`, from `prepare` → `core.hooksPath`): `pre-commit`
  blocks `dev`/`main` commits (`check-branch-discipline.mjs`, ADR-0165), formats
  staged, `preflight`; `pre-push` adds `pnpm lint:effect` (ADR-0139);
  `commit-msg` subject; reinstall: `pnpm hooks:install`.
- **`pnpm preflight`** runs `vp run gates:preflight`, the `vite.config.ts` gate
  DAG (ADR-0164); also `pnpm dev` and CI.
- **`pnpm check`** adds format, lint, `lint:effect`, `test:scripts`, licences,
  typecheck, build, tests, balance reports, and desktop E2E.

## Gates (run by `preflight`)

| Script | Invoke | Purpose |
| --- | --- | --- |
| `run.tasks` | `pnpm preflight` | Gate DAG: `dependsOn` edges, `cache: false`, `VP_RUN_CONCURRENCY_LIMIT` (ADR-0164). |
| `preflight.cjs` | (gate) | Fail fast on an in-progress merge/rebase or conflict markers. |
| `link-claude-skills.mjs` | (gate, `prepare`) | Recreate the `.claude/skills` → `.agents/skills` symlinks for Claude Code. |
| `assert-single-effect.mjs` | (gate) | `effect` single-copy invariant: `--self-test` (9 fixtures) then the lockfile. |
| `assert-runtime-free.mjs` | (gate) | Runtime-free import boundary (ADR-0100 §2, ADR-0128): `--self-test` (15 fixtures) then the pure packages + desktop main. |
| `verify-package-dependencies.mjs` | `pnpm check:dependencies` (gate) | Dependency policy: no floating specs, `effect` is `workspace:*`, internal deps use `workspace:`, toolchain pinned exact. |
| `docs-check.cjs` | (gate) | Markdown links + `#fragment` anchors, ADR index/status/supersession, deferrals ledger, DESIGN amendments. |
| `verify-doc-budgets.mjs` | `pnpm check:doc-budgets` (gate) | Enforce word ceilings in `scripts/doc-budgets.manifest.json` (`--list`). |
| `verify-no-unknown-casts.mjs` | `pnpm check:unknown-casts` (gate) | Ratchet against new `as unknown` casts. Fatal on new anywhere; stale entries fatal in CI, a warning locally (`--strict`, `--prune`, `--write`). |
| `verify-check-parity.mjs` | (gate) | Every `pnpm check` step is invoked by CI or allowlisted (ADR-0140). |
| `verify-tsgo-integration.mjs` | (gate) | Effect toolchain matches the `@effect/tsgo` matrix and is patched (ADR-0139). |

## CI-only checks

| Script | Workflow | Purpose |
| --- | --- | --- |
| `check-commit-msgs.cjs` | `commit-convention.yml` (+ `commit-msg` hook) | Conventional-Commit subjects (range mode, or `--message-file`). |
| `verify-golden-hashes.cjs` | `determinism.yml` | Verify `golden/hashes.json`. |

## Tools (manual)

| Script | Invoke | Purpose |
| --- | --- | --- |
| `adr-index.cjs` | `pnpm adr:index` | Regenerate `docs/adr/README.md`; `docs-check` fails if it drifts. |
| `change-scope.mjs` | `pnpm change-scope --base <ref>` | Versioned change-scope JSON for CI filtering ([usage](../docs/agents/change-scope.md)). |
| `install-hooks.mjs` | `pnpm hooks:install` | Point `core.hooksPath` at `.githooks` (also runs from `prepare`). |
| `new-nation.mjs` | `node scripts/new-nation.mjs` | Scaffold a nation's content ([adding a nation](../docs/agents/adding-a-nation.md)). |
| `optimize-artwork.mjs` | `node scripts/optimize-artwork.mjs` | Regenerate downscaled AVIF card artwork from the JPG sources (macOS `sips`). |
| `vendor-effect-sync.mjs` | `node scripts/vendor-effect-sync.mjs [--verify]` | Regenerate/verify vendored Effect artifacts ([AGENTS.md](../AGENTS.md)). |
| `regenerate-golden-hashes.cjs` | manual | Re-bake `golden/hashes.json` ([golden repinning](../docs/agents/golden-repinning.md)). |
| `release-signing-wizard.sh` | manual | Guided release signing ([desktop signing](../docs/delivery/desktop-signing.md)). |

## Fixtures and support

`scripts/test/` (`pnpm test:scripts`, Node's runner + glob) covers the gates,
including its concurrency, `needs` skipping, timeouts.
`doc-budgets.manifest.json` and `no-unknown-casts.baseline.json` are tracked
inputs; `lib/doc-anchors.cjs` is the anchor library behind `docs-check.cjs`.

New scripts (ADR-0106/0107): fail closed, own your fixtures, and wire into
`preflight`/`check` or a workflow — never leave it undocumented.
