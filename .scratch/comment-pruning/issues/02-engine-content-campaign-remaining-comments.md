# 02: Remove remaining low-value comments — engine, content and campaign

**Type:** implementation

**What to build:** Strip the remaining useless comments from the phase engine,
content schema/compiler/codemod, and campaign/campaign-engine packages: phase and
stage labels that merely restate the function or step beneath them, decorative
banner pairs around a label, and test comments that echo the assertion title.
Preserve rationale-bearing comments.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Phase/stage/step labels that restate the code are removed across the phase engine, content, and campaign packages.
- [x] Decorative banner separators left in place by the earlier sweep are removed; any meaningful label between them is kept.
- [x] Rationale-bearing comments (determinism, canonical ordering, wire format, `§`/ADR cross-references) are preserved.
- [x] Lint and the affected package test suites pass.

## Comments

Removed `Phase N:` narration in `phase-engine/src/month.ts` and the restating
phase labels in `commandPhases.ts`/`economyPhases.ts`; removed `Step N:` labels in
`campaign/src/compiler.ts`; removed the self-referential test-path header and the
`// Helpers` banner in `campaign/test/design03.compliance.test.ts`. Fixed a
mojibake em-dash in `phase-engine/test/integration.test.ts`. Determinism /
canonical-ordering rationale comments preserved.

Validated: `vp lint .` 0 errors; `vp run -r --concurrency-limit 4 test` 2053
passed | 1 skipped.
