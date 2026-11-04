# Bluewave

Deterministic naval strategy game: engine, content compiler, Electron app, one TypeScript monorepo.

## Authority

Read in order: `README.md`, `.ai/ENGINEERING-CONTRACT.md`, `RULES.md`, `.ai/REQUIREMENTS.md` + package `AGENTS.md`, `.ai/SPRINT-PLAN.md` / `.ai/briefs/`, nearby code and tests. Precedence: safety/legal/credential → design → contract → rules → brief → local. A higher layer wins: apply it, note it in one line, continue; stop only when none clearly wins. Harness or session instructions set where work lands (target branch, tools); this file sets how the repo changes.

## Agent workflow

- Standing user authorization: use the `search`, `grep`, `audit`, `runner` subagents (`.claude/agents/`) without asking, for repo-wide searches, call-site hunts, diff audits, and test runs over ~30 s. They return paths, one-line summaries, or failures only.
- Start from the handoff or brief if given; do not re-derive it.
- Context cap: hooks warn at 150k tokens and block a resume above 200k (`scripts/data/agent-context-policy.json`). At the warning, commit and write the handoff (`handoff` skill). [Context efficiency](docs/agents/context-efficiency.md).
- `pnpm agent:map <symbol|path>` before reading (read by range); `pnpm verify:affected` before committing; `pnpm heavy <cmd>`, never `sleep`. [Agent tools](docs/agents/agent-tools.md).
- Size the task, then follow [Delivery](#delivery). **T0** one file, docs or config: no brief. **T1** default: a short [task prompt](.ai/templates/task-prompt.md). **T2** multi-session or foggy: a [task brief](.ai/templates/task-brief.md) and [ORCHESTRATION](.ai/ORCHESTRATION.md). Problem and evidence, then the simplest solution; log routine decisions and continue. [Lifecycle](docs/agents/task-lifecycle.md), [rollback](docs/agents/rollback.md), [access](docs/agents/autonomy-and-access.md). State: `pnpm worktrees status|inbox`.

## Rules

- Session start: `git status`, `git pull --rebase`, `pnpm preflight`. Rebase before every push.
- Never overwrite or reformat others' work. Narrow Conventional commits.
- No code comments; rationale goes in the commit message.
- Max 5 worktrees, one session per checkout.
- Review agents are read-only and their reports are pointers: verify diff, gates, `git status`.
- Doc budgets (`scripts/doc-budgets.manifest.json`) ratchet down; justify raises.
- No ADRs: enforce a rule in a gate, type or test, else add a line to `RULES.md` or the package `AGENTS.md`.
- Research and working notes go to GitHub Discussions (`gh discussion create --category Research`), never the repo. [Issue tracker](docs/agents/issue-tracker.md).

## Code conventions

Determinism (no `Math.random`, wall-clock, `process.env`; canonical hashes identical across OSes), Effect usage, tagged errors, strict schema decoding at boundaries, and the content compiler are in `.claude/rules/` (loaded for `packages/`, `apps/`, `content/`) and [RULES.md](RULES.md).

## Tests

- Red, Green, Refactor; a bug is unconfirmed until a regression test fails before the fix and passes after.
- `vite-plus/test`; exercise production composition, replace only true external boundaries; no sleeps or wall-clock.
- Never weaken gates. [Golden repinning](docs/agents/golden-repinning.md).

## Delivery

Steps 1–2 need no permission.

1. **Branch** off `dev` (`feat|fix|refactor|docs/<slug>`); commit directly on `dev` only when the user or harness names it as the working branch (small, gated commits); never on `main`. A branch the harness names is the PR target: if it is `dev`, say so once and continue.
2. **Push early** and open a **draft PR into `dev`** (only `pr: none` opts out). Containers are ephemeral.
3. **Verify**: `pnpm verify:affected` while iterating; `pnpm preflight`, `pnpm test:scripts`, `pnpm check` on the final commit. Await every gate you start; never end a turn with one pending. If a gate cannot run here, CI is the gate: subscribe to the PR.
4. **Ready** when gates are green, the tree is clean, the subject is Conventional and ACS are met. The PR body lists each gate as `passed`, `failed` or `not run (reason)`.
5. **Merge** only with the brief's authority, else a human merges. No force-push or history rewrite; no secrets, `.env`, stores, caches, machine config. Delete the branch after merge only.
6. **Report** `READY`, `DRAFT (gates pending: <which>)` or `BLOCKED (<stop condition>)` first, then the PR link and observed versus assumed.

`pnpm change-scope` for change-based filtering: [docs](docs/agents/change-scope.md).

## Shipping bar

Playable, Seen (`pnpm snap` for UI), Tunable, Reachable, Explainable, Measured: [shipping bar](docs/agents/shipping-bar.md).

## Guides

[Desktop](docs/agents/desktop-view.md) · [snap](docs/agents/desktop-snap.md) · [modals](docs/agents/modal-guide.md) · [adding a nation](docs/agents/adding-a-nation.md) · [repo map](docs/agents/repo-map.md) · [packages](packages/README.md) (read the package `AGENTS.md` first) · [glossary](GLOSSARY-MAP.md). Issues: GitHub (`joaooliveira92/iron-tide`, `gh`); [labels](docs/agents/triage-labels.md).

`vendor/` and `repos/` are read-only: never lint, reformat, or import from.

## Stop conditions

Write a decision request (`.ai/templates/decision-request.md`) and stop when: plausible interpretations change gameplay; design contradicts itself; required high-authority content is missing; repair would fabricate canonical information; migration changes unapproved authoritative outcomes; a fix expands into a deferred subsystem; destructive data or history rewrite is needed; credentials/secrets/signing/publishing are involved; a dependency raises licence/security concern; determinism cannot be demonstrated; a golden hash changes without understood cause.

Do not stop for routine design choices. Pipeline: [`.ai/ORCHESTRATION.md`](.ai/ORCHESTRATION.md).
