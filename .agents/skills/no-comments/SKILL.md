---
name: no-comments
description: "Spawn Comment Sicko, find every code comment in scope, and delete it unless a tool reads it. Use for /no-comments or a comment-pruning pass."
disable-model-invocation: true
---

# No comments

Code carries no comments. Names, types, and tests state the intent. Rationale
lives in an ADR or the commit message, never beside the code (ADR-0268).

Agents copy what exists. A comment that excuses a workaround becomes the
template for the next workaround. A citation of an ADR or design id decays into
a dead pointer.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the base
branch, default `main`, including the working tree.

Never touch vendored or generated trees: `vendor/**`, `repos/**`, `**/dist/**`,
`**/node_modules/**`, `**/.turbo/**`, `content/generated/**`.

## Classification

Every in-scope comment lands in exactly one bucket. Evidence is a `path:line`
plus the comment text.

- **DELETE** is the default. Banners, narration, doc comments, ownerless TODOs,
  commented-out code, and every citation of `ADR-*`, `DESIGN-*`, `INC-*`,
  `BW-*`, `SPM-*`, `SB3-*`, or a `§` section.
- **REFACTOR** means the comment is a workaround in prose. A suppression hiding a
  type or logic problem, a `for now` or `temporary` note, or an invariant the
  type system should enforce. Name the root-cause fix. Never reword it as a
  comment.
- **TOOL** means a tool reads it. Licence and attribution lines, shebangs,
  triple-slash references, test-runner pragmas, JSDoc type annotations in `.mjs`
  files, and a directive such as `@ts-expect-error` until its REFACTOR lands.

## Steps

1. Spawn `Task` with `subagent_type: "comment-sicko"`. Pass the scope. Do not
   restate its rules.
2. Inspect its report. Reject any edit to application code and any scope escape.
   Treat a `TOOL` claim as false until you name the tool that reads the comment.
3. For `REFACTOR` items, name the root-cause fix that removes the comment. If the
   root cause is out of scope, land the smallest in-scope fix and report the rest
   open.
4. For `DELETE` items, propose the deletion. When a comment states a constraint
   worth keeping, offer the cheapest type, test, or ADR that encodes it, then
   delete the comment.
5. Report the per-bucket counts, fixes, encoding offers, and open work. This run
   is an **analysis**: propose changes, do not apply them, unless the operator
   explicitly asked to edit.
