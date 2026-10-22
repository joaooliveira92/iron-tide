# ADR-0268: Code carries no comments

## Status

Accepted (2026-10-22).

## Context

Agents copy what already exists. A comment that excuses a workaround becomes the
template for the next workaround, so stale notes and hacks spread through the
codebase faster than review removes them.

Citations are the worst case. A comment that cites an ADR or design id looks like
traceability, but the pointer decays. Measured on 2026-10-22 over `.ts` and
`.tsx` comment lines:

- 893 of 1,104 ADR citations (81%) name an ADR that has no file in `docs/adr`.
- 22 of the 29 distinct `DESIGN-*` ids cited in code appear in no document.
- 4,977 comment lines cite an ADR, design, increment, or section id.

No gate reads these comments. The written rules never asked agents to write them.
The habit spread by copying.

## Decision

1. **Code carries no comments.** Names, types, and tests state the intent.
   Rationale lives in an ADR or the commit message, never beside the code.
2. **A short allowlist survives.** Only a comment a tool reads stays: licence and
   attribution lines, shebangs, triple-slash references, test-runner pragmas, and
   JSDoc type annotations in `.mjs` files, and the `test-focus-allow-skip`
   marker. A suppression directive stays only
   until its root cause is fixed.
3. **Existing comments are deleted in waves.** Each wave is one package and one
   commit. The deletion is parser-based, and its proof is that the syntax tree
   with comments stripped is identical before and after.
4. **New comments are rejected.** `pnpm strip:comments --check` runs in
   `pnpm preflight` and fails while any removable comment exists. There is no
   baseline: the tree is clean, so the ban is absolute.
5. **Rationale goes where it can be found.** From now on a change that needs
   to explain a unit, range, ordering, or randomness rule puts it in a type, a
   test, an ADR, or the commit message. The bulk removal did not triage the
   existing comments. Tag `archive/pre-strip-comments` is the recovery point.

## Consequences

- Reviewers stop reading prose beside code. Intent has to show in names and types.
- Rationale that only a comment held is lost. This is
  accepted: most of the cited rationale already points at nothing.
- The `no-comments` skill, `poteto-mode`, `comment-sicko`, and `comment-pruner`
  default to DELETE.
- Suppressions and `as unknown as` casts lose their excuse. They become refactor
  backlog, tracked as tickets.
