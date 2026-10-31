# Working in Bluewave

Bluewave is a deterministic naval strategy game: engine, content compiler, and Electron desktop app in one TypeScript monorepo. This file tells an agent how to work here.

## Authority and reading order

1. `README.md` — design baseline.
2. `.ai/ENGINEERING-CONTRACT.md` — highest code authority.
3. `RULES.md` — binding rules.
4. `.ai/REQUIREMENTS.md` and the package's `AGENTS.md`.
5. `.ai/SPRINT-PLAN.md` / `.ai/briefs/` — approved milestone.
6. The nearby code, tests, exports, and CI.

Precedence: safety/legal/credential → canonical design → contract → rules → brief → local conventions. On conflict, **stop** (see Stop conditions).

## Agent workflow

Run `pnpm agent:map <symbol|path>` before reading, `pnpm verify:affected` before committing, and `pnpm heavy` (not `sleep`) for long gates. See [agent tools](docs/agents/agent-tools.md).

Start substantial tasks from a [task brief](.ai/templates/task-brief.md): problem and evidence first, then the simplest viable solution. Track state with `pnpm worktrees status`/`inbox`; return only when a human is needed. Merge only with the brief's authority; report rollback. See [task lifecycle](docs/agents/task-lifecycle.md), [rollback](docs/agents/rollback.md), [autonomy and access](docs/agents/autonomy-and-access.md).

## Rules

- Check `git status`, `git pull --rebase`, and `pnpm preflight` at session start; rebase before every push.
- Never overwrite or reformat others' work. Keep commits narrow, Conventional.
- No code comments. Names, types, tests carry intent; rationale in the commit message.
- Short-lived branch from `dev`; max 5 worktrees, one session per checkout.
- Review agents are read-only: no edits, commits, branches, or PR state. Reports are pointers, not evidence: verify the diff, gates, and `git status`.
- Doc budgets in `scripts/doc-budgets.manifest.json`; ratchet down, justify raises.
- No ADRs. Enforce a rule in a gate, type or test; otherwise add a line to `RULES.md` or the package `AGENTS.md`.
- Research notes and working documentation live in GitHub Discussions, never in the repository: `gh discussion create --category Research`. The repo keeps code, canonical authority, agent instructions, and generated gate artifacts. See [issue tracker](docs/agents/issue-tracker.md).

## Determinism

Identical content, ruleset, inputs, seeds, and versions produce identical hashes across OSes.

- No `Math.random`, random UUIDs, wall-clock, `process.env`, locale, filesystem order, network, pid, mutable globals, or platform path separators in authoritative code.
- Hierarchical, domain-separated RNG only. Every draw records stream, entity, phase, version, input hash, outcome, and reason.
- Integer/fixed-point arithmetic: branded safe-integer types, checked arithmetic, explicit bounds and rounding.
- Versioned canonical serializer: defined key/collection ordering, Unicode normalization, integer representation; SHA-256 with domain-separated envelopes. Never rely on JS insertion order.

## Effect

- `effect@4.0.2` vendored at `vendor/effect`. Import `effect` or `effect/<Subpath>`; no registry or `repos/`.
- Runtime-free subset in domain packages: `Schema`, `SchemaIssue`, `Data`, `Equal`, `Hash`, `Option`, `Predicate`, `Result`. Full runtime at IO boundaries only (`persistence`, `compiler-cli`, `desktop/src/main`). See [runtime-free gate](docs/agents/runtime-free-gate.md).

## Errors

- In-process: `Data.TaggedError`; wire: `Schema.TaggedError`. Every typed failure needs a stable `_tag`.
- Discriminate by `_tag`, never `instanceof`. Handle at call site with `Effect.catchTag`/`catchTags`/`catchReason`. No `Effect.orDie` except where recovery is intentional.
- Tests discriminate by `_tag` too. One class-based exception: `expect(fn).toThrow(ErrorClass)`.

## Schema and boundaries

- Effect Schema validates every boundary. `Schema.Struct` strips excess keys; decode with `{ onExcessProperty: "error" }` to reject them.
- Never trust external boundaries: decode compiled YAML, saves, IPC envelopes, file contents with strict schema. No `JSON.parse(...) as T`. See [domain](docs/agents/domain.md).
- Wire formats frozen; every schema change needs a parity test from existing fixtures. See [Effect Schema patterns](agent-patterns/effect-schema.md).

## Content and compiler

- Author content as declarative TypeScript; compile to canonical JSON. YAML for i18n and mandated infra only.
- Compiler stages: explicit, statically ordered, typed, immutable, no ambient I/O, randomness, or artifact writes. Accumulate diagnostics; block downstream on invalid prerequisites.
- Validation, normalization, repair are distinct. Repair is explicit, narrow, logged, limited to safely recomputable data. See [canonical content](docs/architecture/canonical-content-and-rulesets.md).

## Services and composition

- `Context.Service` for stable dependencies; per-call inputs as args. A method is `Effect<A, E, never>` unless genuinely per-call.
- PascalCase for types/services/schemas/errors; camelCase for values. Use `.pipe()` for linear composition, `Effect.gen` for sequential workflows. Stay in Effect (`Deferred`/`Queue`/`FiberSet`, not `runPromise`); log with `Effect.log*`, never `console.*`.

## Tests

- Red, Green, Refactor. Bug unconfirmed until a regression test fails before the fix and passes after.
- Tests on `vite-plus/test`. Exercise production composition; replace only true external boundaries. No sleep-based synchronization or wall-clock-dependent tests.
- Done: `pnpm preflight`, `pnpm test:scripts`, `pnpm check` green; clean tree; Conventional subject; ACS met. Never weaken gates. Golden re-pins: [golden repinning](docs/agents/golden-repinning.md).

## Git

- No commits on `dev`/`main`. Merge branch into `dev` when gates green; PR optional. Delete branch only after merge.
- No force-push, no history rewrite. No secrets, `.env`, stores, caches, or machine-specific config.
- Use `pnpm change-scope` for change-based filtering: [change scope](docs/agents/change-scope.md).

## Shipping bar

- **Playable**: desktop launches, vertical slice runs on every merge.
- **Seen**: UI change verified with `pnpm snap` before done.
- **Tunable**: numbers in content/balance data, marked PROVISIONAL until sourced; code holds mechanisms, not magic numbers.
- **Reachable**: a change that adds player-facing engine capability names its UI path or adds a `dormant-by-decision` row to `scripts/data/reachability-ledger.json` (`pnpm check:reachability-ledger`).
- **Explainable**: every player-facing number traces to an explanation tree.
- **Measured**: balance claims cite generated reports (`pnpm check:balance-reports`), not intuition.

## Task guides

- Desktop renderer/main/preload: [desktop view](docs/agents/desktop-view.md)
- Screenshot, Aria tree, console: [desktop snap](docs/agents/desktop-snap.md)
- Adding a nation: [adding a nation](docs/agents/adding-a-nation.md)
- Editing inside a package: read its `AGENTS.md` first; roster in [packages/README.md](packages/README.md)
- Unsure where something lives: [repo map](docs/agents/repo-map.md)

## Vendored repos

`vendor/` and `repos/` are read-only — never lint, reformat, or import from. `repos/` may be absent in a normal checkout.

## Stop conditions

Stop and write a decision request (`.ai/templates/decision-request.md`) when: plausible interpretations change gameplay; design contradicts itself; required high-authority content is missing; repair would fabricate canonical information; migration changes unapproved authoritative outcomes; fix expands scope into deferred subsystem; destructive data or history rewrite needed; credentials/secrets/signing/publishing involved; dependency raises licence/security concern; determinism cannot be demonstrated; golden hash changes without understood cause.

Do not stop for routine design choices. Pipeline: [`.ai/ORCHESTRATION.md`](.ai/ORCHESTRATION.md).

## Agent skills

- Issues: GitHub Issues (`joaooliveira92/iron-tide`), `gh` CLI. Research and docs: GitHub Discussions, category `Research`. See [issue tracker](docs/agents/issue-tracker.md).
- Labels: [triage labels](docs/agents/triage-labels.md).
- Domain: [GLOSSARY-MAP.md](GLOSSARY-MAP.md) → per-context `GLOSSARY.md`. See [domain docs](docs/agents/domain.md).
