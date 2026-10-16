# Validation Report: U-1 Canonical values (scoping sprint)

## Outcome

`PASS_WITH_LIMITATIONS` — the scoping deliverable (chart → research → spec →
slice → brief → traceability) is complete and the standing documentation gates are
green. No implementation was performed, so the acceptance evidence for U-1 itself
is deferred to the ticket set.

## Scope delivered

Delivered (documentation/planning only):

- the wayfinder map and route decisions `.scratch/u-1-canonical-values/map.md` +
  `decisions/D1`–`D7`;
- the grounding research note `docs/research/u-1-canonical-values.md`;
- the spec `.scratch/u-1-canonical-values/spec.md` (to-spec format; six U-1
  acceptance criteria traced to requirement IDs and proving tests/gates);
- eight tracer-bullet tickets `.scratch/u-1-canonical-values/issues/01`–`08`;
- the milestone brief `.ai/briefs/u-1-canonical-values.md`;
- traceability: `.ai/specs/u-1-canonical-values.md` pointer and the
  `.ai/SPRINT-PLAN.md` Frontier update.

Deferred (not started): every implementation ticket 01–08. Value-preserving
tickets 01–05 are on the frontier; tickets 06–08 (combat/economy float→fixed
conversions and U-1 acceptance) are gated by decision request 0005.

## Requirements evidence

No code symbols are claimed: this sprint changed documentation only. The spec's
"Acceptance criteria traceability" table maps each `.ai/SPRINT-PLAN.md` U-1
criterion to requirement IDs (BW-PRS-001/004, BW-DET-001/003, BW-ARC-001/002,
BW-STA-001, BW-RUL-001) and to the tests/gates that must prove it at
implementation. Brief: `.ai/briefs/u-1-canonical-values.md`.

## Commands and observed results

```text
pnpm preflight
exit 0 — 40 tasks; docs links/anchors, ADR index, deferrals, doc budgets,
no-unknown-casts, boundary decode, tagged errors, runtime-free, single-effect,
tracker consistency all green ("vp run: 0/40 cache hit")

pnpm test:scripts
exit 0 — tests 200, pass 200, fail 0, cancelled 0, skipped 0 (1328 ms)

pnpm format
exit 0 — "All matched files use the correct format." (2599 files)
```

Not run, and why:

- `pnpm check` end-to-end and `node scripts/verify-golden-hashes.cjs` — `check:golden`
  cannot run because `golden/hashes.json` does not exist (pre-existing root
  blocker, decision request 0005). No code or authoritative artifact changed in
  this sprint, so the code/test/build gates are unchanged from the 2026-10-15
  baseline.

## Determinism evidence

- Content artifact hash: unavailable — no content or authoritative artifact changed.
- Initial/closing snapshot hash: unavailable — no code changed.
- Command/event/financial/random-decision ledger hashes: unavailable — not run.
- Replay result: unavailable — no code changed.
- Processes and operating systems used: darwin (macOS), Node per the repo policy.

Marked unavailable, not passed: a documentation-only sprint produces no new
authoritative evidence.

## Canonical artifact changes

None. No old/new hash pair; no version impact; no migration; no regeneration
required.

## Tests added

None (scoping sprint). The spec/`issues` name the tests to add at implementation.

## Security and cancellation

No change. No trust boundary, parser, path, temp-output, abort or cleanup code was
touched.

## Performance observations

None collected. No performance-sensitive code changed.

## ADRs and dependencies

- No ADR recorded in this sprint (scoping). The brief lists the implementation
  ADRs U-1 must record: canonical unit table and its home; money type, scale and
  the single bridge rounding mode; rounding/fixed-point rules and the
  authoritative-float gate; the conversion/locale boundary; the float→fixed
  conversion and its re-pin.
- No new dependencies.

## Known limitations and deferred requirements

- U-1 is not accepted; only scoped. Tickets 01–08 carry the implementation.
- Tickets 06–08 are blocked by decision request 0005 (absent golden baseline).
- The combat/economy float→fixed conversion delta is unmeasured until
  implementation; the brief records the D5 stop surface if the delta is material.
- National Historical currency configuration content needs an owner and primary
  historical sources; it is U-3 content, not U-1.

## Changed files

- `.ai/SPRINT-PLAN.md` — Frontier updated to record U-1 scoped and to point the
  actionable frontier at U-1 tickets 01–05.
- `.ai/briefs/u-1-canonical-values.md` — new milestone brief.
- `.ai/specs/u-1-canonical-values.md` — new spec pointer.
- `.ai/reports/u-1-canonical-values.md` — this report.
- `.scratch/u-1-canonical-values/` — new: `map.md`, `spec.md`,
  `decisions/D1`–`D7`, `issues/01`–`08`.
- `docs/research/u-1-canonical-values.md` — new research note.

## Git and remote status

- Branch: `refactor/comment-prune-sweep-a` (the plan's documented baseline branch).
- Commits: this sprint's Conventional Commit on the branch
  (`docs(campaigns): chart and slice the U-1 canonical-values sprint`).
- Working tree: clean after the commit.
- Push status: not pushed — no remote is configured in this checkout.
- Pull request: none (no remote).
- Merge performed: no.

## Secondary consistency check

- `pnpm preflight` re-run green, including `verify-tracker-consistency` (the ticket
  `Blocked by:` references resolve to siblings; the spec advertises `ready-for-agent`
  with non-terminal tickets, so no false-done warning).
- Re-read `map.md`, `spec.md` and the eight tickets: every `Blocked by:` names an
  existing sibling; statuses use the recognised vocabulary (`ready-for-agent`,
  `blocked`).
- Confirmed no code, content, test or golden file was modified; only documentation,
  the brief, the research note and the plan's Frontier changed.
- Confirmed `.DS_Store` and other machine files are not staged.
