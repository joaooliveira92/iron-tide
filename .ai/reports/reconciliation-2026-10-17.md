# Reconciliation report: boot state, worktrees, trackers, and owner decisions

Date: 2026-10-17 · Branch: `chore/reconcile-trackers-and-decisions` (from `origin/dev`
`51632a0`) · Type: **governance and repository-state reconciliation only** — no
gameplay, compatibility, content, or production-value change.

## Scope and authority

Instruction: reconcile the boot state against `dev`; repair `WORKTREES.md`; reconcile
the authority/tracking model; materialize owner decisions 0005–0008 into decision-ready
records; re-evaluate the frontier; validate; commit, push, and open a PR (no
self-merge). Do **not** implement S-1/S-2/N-1/07 or choose placeholder production
values, and do not mirror completed scratch artifacts into GitHub Issues.

Baseline for this branch is the latest remote `dev` (`51632a0`), which already carries
U-5 (PR #21, merged). The U-5 report, commits, PR, and validation evidence are
preserved untouched.

## 1. Boot-state reconciliation

- `chore/issue-tracker-migration` (`ba4add3`) is confirmed an **ancestor of
  `origin/dev`** — merged via PR #20 (`6c0d1d9`). It was the branch the previous boot
  ran on; it is not the current baseline.
- U-5 (PR #21, `feat/u-5-presentation-invariance`) is **merged**; `origin/dev` is
  `51632a0` ("Merge pull request #21"). PR #21 was **not** modified.
- The reconciliation branch was created from `origin/dev`; no U-5 branch work was
  mixed in.

## 2. Worktree ledger (`WORKTREES.md`)

Findings (`git worktree list --porcelain` vs the ledger):

- Three **phantom** rows — `u-3-formatting-boundary`, `u-4-options-screen`,
  `determinism-gate-hardening` — had no worktree and no branch.
- One **unregistered** live worktree — `.worktrees/work` on `dev`.

Action: `pnpm worktrees sync` (the sanctioned tool) dropped the three phantom rows and
registered the live subtree; its row was then labelled honestly
(`(primary dev checkout, not an effort)` / owner `user`). Historical fact is preserved
in git history and the per-effort reports, so nothing was lost by removing the drift.

Automated validation **already exists**: `scripts/verify-worktrees.mjs` (`gate:worktrees`
in `pnpm preflight`) surfaces stale/phantom/unregistered subtrees. After the repair:
`node scripts/verify-worktrees.mjs` → **`worktrees: ok (1 active)`**.

## 3. Authority and tracking model

Edits (all documentation; no behavior):

- `.ai/AUTHORITY-INDEX.md`: two register rows were stale (`.ai/specs/` "present but
  empty and untracked"; `golden/hashes.json` "generated and untracked") → corrected to
  **present and tracked** (golden created at `0117adc`). The line "`.scratch/` is not
  restored: no tracked authoritative document depends on it" contradicted the 179
  tracked `.scratch/` files and the `.ai/specs/` pointers → replaced. Added a
  **Tracking model** section.
- Stale `docs/PROGRESS.md` / `docs/OPEN-ISSUES.md` reading-list pointers in
  `.opencode/command/{boot,sprint,work}.md`, `.ai/ORCHESTRATION.md`, and
  `.ai/briefs/u-1-canonical-values.md` → replaced with the replacement authorities
  (`.ai/AUTHORITY-INDEX.md` + `.ai/reports/*`). Both files are confirmed **intentionally
  unavailable** (they are register rows), not accidentally missing.
- Tracker coexistence reconciled in `docs/agents/issue-tracker.md`: GitHub Issues is
  the declared tracker for new issues; `.scratch/<slug>/` remains the pipeline's
  per-effort store (tracked, referenced by `.ai/specs/`), and completed internal
  artifacts are **not** mirrored into GitHub Issues.
- **No public GitHub issues were created.**

## 4. Decision-ready packets (0005–0008)

Each `.ai/decision-requests/000X-*.md` gained a **Decision-ready packet (reconciled
2026-10-17)** with: exact question, affected scope, constraints/invariants, options,
consequences (gameplay / determinism / saves / wire / balance / content / tests /
migration), recommendation, minimum owner response, and an explicit must-not-guess.

| #    | Question                                                                                           | Recommendation                                              | Notes                                                    |
| ---- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| 0005 | Approve N-1/07 officer rosters + seeded divisions, moving the reference hashes (re-pin in-commit)? | Approve (Option A); magnitudes as ADR-0213 balance choices  | Baseline now exists, so the original blocker is resolved |
| 0006 | How to satisfy S-2's required `NationState.prestige` against untouched production?                 | A (labelled ADR-0213 placeholder), else B (gate on 0003)    | C (optional field) contradicts D2                        |
| 0007 | What production values for S-1 readiness/crew/maintenance?                                         | A (research-grounded constants + `balance_adjustment` rest) | Do not ship placeholder rates as production              |
| 0008 | Confirm the baseline-restoration remediation                                                       | Close as resolved by Option A                               | Baseline independently observed green                    |

No gameplay values were chosen; the packets only state the questions and options.

## 5. Frontier re-evaluation

No implementation lane is **independently acceptable**:

- **S-1** tickets 02–07/09 are queued on **0007** — tickets 02–06 charge and ramp with
  production values, so shipping placeholder rates would embed a speculative default.
  Only the value-free structural seam has landed (ticket 01).
- **S-2** tickets 02–07/09 are queued on **0006**; ticket 08 on **0003**.
- **N-1 ticket 07** is queued on **0005**.

The only decision-independent work is **governance** (this pass). No structural
scaffolding is proposed, because every remaining structural ticket either depends on a
blocked sprint or would embed a placeholder production value. `.ai/SPRINT-PLAN.md`'s
Frontier section was updated to say exactly this.

## 6. Validation evidence (exact commands + observed results)

| Command                             | Observed result                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm preflight`                    | **exit 0**; `worktrees: ok (1 active)`; `docs-check: ok (97 links, 0 anchored, 22 ADRs indexed)`; `verify-doc-budgets: 28 budgeted docs within ceiling` |
| `pnpm format`                       | **exit 0**                                                                                                                                              |
| `pnpm lint`                         | **exit 0** (0 warnings, 0 errors)                                                                                                                       |
| `pnpm typecheck`                    | **exit 0**                                                                                                                                              |
| `pnpm test:scripts`                 | **exit 0** (209 tests)                                                                                                                                  |
| `node scripts/verify-worktrees.mjs` | **`worktrees: ok (1 active)`**                                                                                                                          |

The full desktop suite was **not** re-run: no production or executable behavior
changed (documentation, `WORKTREES.md`, and operating-prompt edits only).

## 7. Explicitly not done

- No S-1 / S-2 / N-1-07 / baseline gameplay implementation.
- No placeholder or production values chosen.
- No GitHub issues created or completed artifacts mirrored.
- PR #21 not modified; U-5 delivery untouched.

## 8. Commit / PR

See the delivery message: branch `chore/reconcile-trackers-and-decisions`, a single
focused Conventional Commit, pushed with a PR opened against `dev` (no self-merge).
