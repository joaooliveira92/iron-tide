# 03: Remove remaining low-value comments — ship-build and support packages

**Type:** implementation

**What to build:** Strip the remaining useless comments from the ship-design,
ship-visual and armament packages, and from the support packages (commands,
persistence, events, deterministic, random, ai, diagnostics, contracts,
cross-process-test, test-support): section labels and name-restating labels that
add nothing, and stale comments. Preserve rationale-bearing comments — in
particular the persistence integrity notes and the ship-design unit/rounding
justifications.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Name-restating and bare section labels are removed across the ship-build and support packages.
- [x] Stale comments are removed or corrected.
- [x] Rationale-bearing comments are preserved: ship-design unit/integer-arithmetic and rounding justifications, persistence integrity/ADR notes, wire-format parity notes.
- [x] Lint and the affected package test suites pass.

## Comments

Removed `// Stage N …` labels in `ship-design/src/compileStages.ts`, the
name-restating labels in `partCatalogue.ts` (`// Tags.`, `// Engineering.`,
`// Capabilities.`, `// components.yaml`, …), and the `// Build the modified
design.` label in `refit.ts`; removed `// Cooling` in `systems.ts`. Removed the
`Step N:` narration in `cross-process-test/src/run-child.ts` and
`test/production-pack-loop.test.ts`. Ship-design unit/rounding justifications and
persistence integrity notes preserved.

Validated: `vp lint .` 0 errors; `vp run -r --concurrency-limit 4 test` 2053
passed | 1 skipped.
