---
name: no-comments
description: "Spawn Comment Sicko, classify every in-scope comment as DELETE, REFACTOR, or KEEP, and act on accepted findings. Use for /no-comments or a comment-pruning pass."
disable-model-invocation: true
---

# No comments

Spawn **Comment Sicko** (the `comment-sicko` subagent). Act on accepted findings.
Defer to Comment Sicko's fresh perspective, then verify its report yourself.

## The rule

A comment earns its place only when it records a **non-obvious why the code
cannot show**. Everything else is noise. Comments follow the same rule as the
reply in `poteto-mode`.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the base
branch, default `main`, including the working tree.

Never touch vendored or generated trees: `vendor/**`, `repos/**`, `**/dist/**`,
`**/node_modules/**`, `**/.turbo/**`, `content/generated/**`.

## Classification

Every in-scope comment lands in exactly one bucket. Evidence is a `path:line`
plus the comment text.

- **DELETE** — noise with no information you could not get from the code.
  Examples: restates the code (`// increment i`), narrates a phase (`// Phase 1:
  add cards`), commented-out code, a stale TODO that names no owner or ticket, or
  a doc comment that only repeats a name.
- **REFACTOR** — the comment is a *symptom of a code smell*; fixing the cause
  removes the need for it. The comment is a workaround in prose.
  - A suppression that hides a real type/logic problem. `@ts-expect-error`,
    `@ts-ignore`, `eslint-disable`/`oxlint-disable`, `as unknown as` casts.
  - A comment that explains a hack, a `for now`, a `temporary`, or a special
    case: the fix is the missing abstraction or the missing type, not the comment.
  - A comment that lists invariants the type system should enforce.
- **KEEP** — a non-obvious why the code cannot show. Test: if you deleted it, a
  competent maintainer would re-introduce the bug or re-litigate the decision.
  - **Domain and canonical rationale.** `DESIGN-*`, `ADR-*`, `BW-*`, ruleset
    version, determinism rationale (RNG stream identity, integer/fixed-point
    rounding, canonical ordering), safety constraints.
  - **Traceability to an external ticket.** `TODO #N` and similar that name a
    tracked issue, owner, or doc.
  - **Constraints you cannot change.** `do not remove`, `do not change wording`,
    `talk to X before changing`, wire-format or compatibility freezes.

## Steps

1. Spawn `Task` with `subagent_type: "comment-sicko"`. Pass the scope. Do not
   restate its rules.
2. Inspect its report. Reject application-code edits, scope escapes, and flags
   that treat kept intentional code as guilty. A `KEEP` survives only with proof
   it is about something we cannot change. Audit for missed suppressions.
   Correctness or safety suppressions stay actionable `REFACTOR`s. Before
   accepting a thin `IMPORTANT` or `do not remove` kill, read the symbol it
   guards. An ambiguous kill is not applied.
3. For `REFACTOR` items, name the root-cause fix that removes the comment. Do not
   bolt on a symptom guard. If the root cause is out of scope, land the smallest
   in-scope fix and report the rest open. The **Fix Root Causes** principle in
   `poteto-mode` guides intent only; it does not authorize widening the fence.
4. For `DELETE` items, propose the deletion. For constraint comments, offer the
   cheapest in-scope type, runtime, test, or CI lint that encodes the constraint,
   then delete. Otherwise keep it and report the constraint open.
5. Report the per-bucket counts, restored comments, fixes, encoding offers, and
   open work. This run is an **analysis**: propose changes, do not apply them,
   unless the operator explicitly asked to edit.
