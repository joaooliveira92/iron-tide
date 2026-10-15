# 01: Remove remaining low-value comments — combat

**Type:** implementation

**What to build:** Strip the remaining useless comments from the combat package:
bare section labels ("Helpers", "Constants", "Public API", "Evaluator"), step
narration that restates the code, and stale comments describing behaviour the
code has already left (e.g. "smoke deferred to M3", "deferred to M3/C-5").
Preserve every comment that carries contract rationale.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] No bare section-label or step-narration comments remain in the combat package.
- [x] Stale "deferred" comments that describe already-shipped subsystems are removed or corrected.
- [x] Rationale-bearing comments are preserved: determinism decisions, integer/unit bounds, wire/back-compat notes, `§`/ADR cross-references, random-ledger provenance.
- [x] Combat lint and test suite pass.

## Comments

Removed bare section labels ("Helpers", "Constants", "Public API", "Evaluator",
"Input/Output types", …) and `Step N:` narration across `packages/combat/src` and
its tests. Corrected the two shipped-subsequent "smoke deferred to M3" comments
(`weather/battle-init.ts`, `weather/engine.ts`); retained design-reference
"deferred" notes that still carry contract rationale (`weather/components.ts`,
`weather/reasonCodes.ts`, `damage/pipeline.ts` STAGE_7_RESERVED). Rationale
comments (`§`/DESIGN references, wire-format, integer-unit notes) preserved.

Validated: `vp lint .` 0 errors; `vp run -r --concurrency-limit 4 test` 2053
passed | 1 skipped.
