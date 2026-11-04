# Bluewave

Deterministic naval strategy game: engine, content compiler, Electron app, one TypeScript monorepo.

## Authority

Read in order: `README.md`, `.ai/ENGINEERING-CONTRACT.md`, `RULES.md`, `.ai/REQUIREMENTS.md` + package `AGENTS.md`, `.ai/SPRINT-PLAN.md` / `.ai/briefs/`, nearby code and tests. Precedence: safety/legal/credential → design → contract → rules → brief → local. On conflict, stop.

## Agent workflow

- Standing user authorization: use the `search`, `grep`, `audit`, `runner` subagents (`.claude/agents/`) without asking, for repo-wide searches, call-site hunts, diff audits, and test runs over ~30 s. They return paths, one-line summaries, or failures only.
- Start from the handoff or brief if given; do not re-derive it.
- Context cap: hooks warn at 150k tokens and block a resume above 200k (`scripts/data/agent-context-policy.json`). At the warning, commit and write the handoff (`handoff` skill). [Context efficiency](docs/agents/context-efficiency.md).
- `pnpm agent:map <symbol|path>` before reading (read by range); `pnpm verify:affected` before committing; `pnpm heavy <cmd>`, never `sleep`. [Agent tools](docs/agents/agent-tools.md).
- Substantial work starts from a [task brief](.ai/templates/task-brief.md) or [task prompt](.ai/templates/task-prompt.md): problem and evidence, then the simplest solution. Log routine decisions in the brief and continue; return only at a stop condition. Merge only with the brief's authority; report rollback. [Lifecycle](docs/agents/task-lifecycle.md), [rollback](docs/agents/rollback.md), [access](docs/agents/autonomy-and-access.md). State: `pnpm worktrees status|inbox`.

## Rules

- Session start: `git status`, `git pull --rebase`, `pnpm preflight`. Rebase before every push.
- Never overwrite or reformat others' work. Narrow Conventional commits.
- No code comments; rationale goes in the commit message.
- Short-lived branch from `dev`; max 5 worktrees, one session per checkout.
- Review agents are read-only and their reports are pointers: verify diff, gates, `git status`.
- Doc budgets (`scripts/doc-budgets.manifest.json`) ratchet down; justify raises.
- No ADRs: enforce a rule in a gate, type or test, else add a line to `RULES.md` or the package `AGENTS.md`.
- Research and working notes go to GitHub Discussions (`gh discussion create --category Research`), never the repo. [Issue tracker](docs/agents/issue-tracker.md).

## Determinism

Same content, ruleset, inputs, seeds, versions → same hashes on every OS. In authoritative code: no `Math.random`, UUIDs, wall-clock, `process.env`, locale, fs order, network, pid, mutable globals, path separators. Use domain-separated hierarchical RNG, integer/fixed-point math, the versioned canonical serializer with domain-separated SHA-256. [RULES.md](RULES.md#determinism).

## Code

- **Effect** (`effect@4.0.2`, vendored): domain packages use the runtime-free subset; full runtime only at IO boundaries (`persistence`, `compiler-cli`, `desktop/src/main`). Stay in Effect (no `runPromise`); log with `Effect.log*`, never `console.*`; `Context.Service` for stable dependencies. [Gate](docs/agents/runtime-free-gate.md).
- **Errors**: `Data.TaggedError` in-process, `Schema.TaggedError` on the wire, stable `_tag`. Discriminate by `_tag`, never `instanceof` (except `expect(fn).toThrow(Class)`); `Effect.catchTag(s)`; `Effect.orDie` only for intentional recovery.
- **Schema and boundaries**: Effect Schema decodes every boundary with `{ onExcessProperty: "error" }`; no `JSON.parse(...) as T`. Wire formats are frozen: schema changes need a parity test from existing fixtures. [Domain](docs/agents/domain.md), [patterns](agent-patterns/effect-schema.md).
- **Content/compiler**: content is declarative TypeScript compiled to canonical JSON (YAML only for i18n and mandated infra). Stages are explicit, ordered, immutable, accumulate diagnostics; validation, normalization, repair stay distinct; repair is narrow and logged. [Canonical content](docs/architecture/canonical-content-and-rulesets.md).

Details: [RULES.md](RULES.md).

## Tests

- Red, Green, Refactor; a bug is unconfirmed until a regression test fails before the fix and passes after.
- `vite-plus/test`; exercise production composition, replace only true external boundaries; no sleeps or wall-clock.
- Done = `pnpm preflight`, `pnpm test:scripts`, `pnpm check` green; clean tree; Conventional subject; ACS met. Never weaken gates. [Golden repinning](docs/agents/golden-repinning.md).

## Git

- No commits on `dev`/`main`; merge branch into `dev` when green (PR optional); delete branch only after merge.
- No force-push or history rewrite. No secrets, `.env`, stores, caches, machine config.
- `pnpm change-scope` for change-based filtering. [Docs](docs/agents/change-scope.md).

## Shipping bar

- **Playable**: desktop launches, vertical slice runs on every merge.
- **Seen**: UI changes verified with `pnpm snap`.
- **Tunable**: numbers live in content/balance data, PROVISIONAL until sourced; no magic numbers in code.
- **Reachable**: new player-facing engine capability names its UI path or adds a `dormant-by-decision` row to `scripts/data/reachability-ledger.json`.
- **Explainable**: every player-facing number traces to an explanation tree.
- **Measured**: balance claims cite generated reports (`pnpm check:balance-reports`).

## Guides

[Desktop](docs/agents/desktop-view.md) · [snap](docs/agents/desktop-snap.md) · [modals](docs/agents/modal-guide.md) · [adding a nation](docs/agents/adding-a-nation.md) · [repo map](docs/agents/repo-map.md) · [packages](packages/README.md) (read the package `AGENTS.md` first) · [glossary](GLOSSARY-MAP.md). Issues: GitHub (`joaooliveira92/iron-tide`, `gh`); [labels](docs/agents/triage-labels.md).

`vendor/` and `repos/` are read-only: never lint, reformat, or import from.

## Stop conditions

Write a decision request (`.ai/templates/decision-request.md`) and stop when: plausible interpretations change gameplay; design contradicts itself; required high-authority content is missing; repair would fabricate canonical information; migration changes unapproved authoritative outcomes; a fix expands into a deferred subsystem; destructive data or history rewrite is needed; credentials/secrets/signing/publishing are involved; a dependency raises licence/security concern; determinism cannot be demonstrated; a golden hash changes without understood cause.

Do not stop for routine design choices. Pipeline: [`.ai/ORCHESTRATION.md`](.ai/ORCHESTRATION.md).
