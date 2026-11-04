# Working in Bluewave

Bluewave is a deterministic naval strategy game: engine, content compiler, and Electron desktop app in one TypeScript monorepo. This file tells an agent how to work here.

## Authority and reading order

`README.md` (design baseline) → `.ai/ENGINEERING-CONTRACT.md` (code authority) → `RULES.md` → `.ai/REQUIREMENTS.md` and the package's `AGENTS.md` → the approved milestone in `.ai/SPRINT-PLAN.md` or `.ai/briefs/` → nearby code, tests, exports, CI.

Precedence: safety/legal/credential → canonical design → contract → rules → brief → local conventions. A higher layer wins: apply it, note it in one line, continue. **Stop** only when no layer clearly wins. Session or harness instructions (target branch, tools) set where work lands; this file sets how the repo changes.

## Agent workflow

Run `pnpm agent:map <symbol|path>` before reading, `pnpm verify:affected` before committing, and `pnpm heavy <cmd>` (not `sleep`) for long gates. Read code by range; hooks in `.claude/settings.json` enforce it. See [agent tools](docs/agents/agent-tools.md) and [context efficiency](docs/agents/context-efficiency.md).

Size the task, then follow [Delivery](#delivery). **T0** one file, docs or config: no brief. **T1** the default: a short [task prompt](.ai/templates/task-prompt.md). **T2** multi-session or foggy: a [task brief](.ai/templates/task-brief.md) and [ORCHESTRATION](.ai/ORCHESTRATION.md). Problem and evidence first, then the simplest viable solution; record routine decisions and continue. Track state with `pnpm worktrees status`/`inbox`. See [task lifecycle](docs/agents/task-lifecycle.md), [rollback](docs/agents/rollback.md), [autonomy and access](docs/agents/autonomy-and-access.md).

## Rules

- Check `git status`, `git pull --rebase`, and `pnpm preflight` at session start; rebase before every push.
- Never overwrite or reformat others' work. Keep commits narrow, Conventional.
- No code comments. Names, types, tests carry intent; rationale in the commit message.
- Max 5 worktrees, one session per checkout.
- Review agents are read-only: no edits, commits, branches, or PR state. Reports are pointers, not evidence: verify the diff, gates, and `git status`.
- Doc budgets in `scripts/doc-budgets.manifest.json`; ratchet down, justify raises.
- No ADRs. Enforce a rule in a gate, type or test; otherwise add a line to `RULES.md` or the package `AGENTS.md`.
- Research and working notes live in GitHub Discussions or the PR body, never in the repository. See [issue tracker](docs/agents/issue-tracker.md).

## Determinism

Identical content, ruleset, inputs, seeds, and versions produce identical hashes across OSes.

- No `Math.random`, random UUIDs, wall-clock, `process.env`, locale, filesystem order, network, pid, mutable globals, or platform path separators in authoritative code.
- Hierarchical, domain-separated RNG; integer or fixed-point math; the versioned canonical serializer with domain-separated SHA-256 envelopes. Full rules: [RULES.md](RULES.md#determinism).

## Effect

- `effect@4.0.2` vendored at `vendor/effect`: import `effect` or `effect/<Subpath>`. Domain packages use the runtime-free subset; the full runtime lives at IO boundaries only. [Runtime-free gate](docs/agents/runtime-free-gate.md), [RULES.md](RULES.md#effect-source-of-truth).

## Errors

- `Data.TaggedError` in-process, `Schema.TaggedError` on the wire, each with a stable `_tag`. Discriminate by `_tag`, never `instanceof` (`expect(fn).toThrow(ErrorClass)` excepted). Handle with `Effect.catchTag`/`catchTags`. [RULES.md](RULES.md#errors).

## Schema and boundaries

- Effect Schema decodes every boundary strictly (`{ onExcessProperty: "error" }`); no `JSON.parse(...) as T`. Wire formats are frozen: a schema change needs a parity test. [Domain](docs/agents/domain.md), [patterns](agent-patterns/effect-schema.md), [RULES.md](RULES.md#schema-and-boundaries).

## Content and compiler

- Content is declarative TypeScript compiled to canonical JSON (YAML for i18n and mandated infra only). Compiler stages are explicit, ordered, immutable; validation, normalization, and repair stay distinct. [Canonical content](docs/architecture/canonical-content-and-rulesets.md), [RULES.md](RULES.md#content-and-compiler).

## Services and composition

- `Context.Service` for stable dependencies; stay in Effect (no `runPromise`); log with `Effect.log*`, never `console.*`. [RULES.md](RULES.md#services-layers-composition).

## Tests

- Red, Green, Refactor. Bug unconfirmed until a regression test fails before the fix and passes after.
- Tests on `vite-plus/test`. Exercise production composition; replace only true external boundaries. No sleep-based synchronization or wall-clock-dependent tests.
- Never weaken gates. Golden re-pins: [golden repinning](docs/agents/golden-repinning.md).

## Delivery

One path from task to merge; steps 1–2 need no permission.

1. **Branch**: short-lived `feat|fix|refactor|docs/<slug>` off `dev`; never commit on `dev`/`main`. A branch the session or harness names is the PR target, not the working branch: if it is `dev`, say so in your first message and continue.
2. **Push early**: push after the first commit and open a **draft PR into `dev`** (only `pr: none` in the brief opts out). Cloud containers are ephemeral; unpushed work is lost.
3. **Verify**: `pnpm verify:affected` while iterating; `pnpm preflight`, `pnpm test:scripts`, `pnpm check` once on the final commit. Await every gate you start; never end a turn with one pending. A gate that cannot run here defers to CI: subscribe to the PR and wait.
4. **Ready**: mark the PR ready when gates are green, the tree is clean, the subject is Conventional and ACS are met. The PR body lists each gate as `passed`, `failed` or `not run (reason)`.
5. **Merge**: only with the brief's authority; otherwise a human merges. No force-push or history rewrite; no secrets, `.env`, stores, caches, or machine config. Delete the branch after merge only.
6. **Report**: open with `READY`, `DRAFT (gates pending: <which>)` or `BLOCKED (<stop condition>)`, then the PR link and what is observed versus assumed.

Use `pnpm change-scope` for change-based filtering: [change scope](docs/agents/change-scope.md).

## Shipping bar

Playable, Seen (`pnpm snap` for UI), Tunable, Reachable, Explainable, Measured: see [shipping bar](docs/agents/shipping-bar.md).

## Task guides

- Desktop renderer/main/preload: [desktop view](docs/agents/desktop-view.md)
- Screenshot, Aria tree, console: [desktop snap](docs/agents/desktop-snap.md)
- Any modal, dialog, confirmation or drawer: [modal guide](docs/agents/modal-guide.md)
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
