# 08: U-1 acceptance

**What to build:** The U-1 acceptance pass: all six `.ai/SPRINT-PLAN.md` U-1
criteria traceable to named tests/gates, the implementation ADRs recorded and
indexed, and the full validation gate green on the exact commit.

**Blocked by:** 02, 03, 04, 05, 06, 07.

**Status:** done

All blockers 02–07 are done.

- [x] All six U-1 acceptance criteria — canonical unit table; fixed-precision
      integer monetary representation; rounding and number-formatting boundaries;
      UI language vs formatting locale separate; float/display-leakage audit;
      conversion only at the application boundary — are traceable to named tests
      or gates.
- [x] The implementation ADRs are recorded and indexed (`pnpm adr:index`):
      ADR-0215 (canonical unit table and its home); ADR-0216 (money type, scale
      and the single bridge rounding mode); ADR-0217 (rounding/fixed-point rules
      and the float gate); ADR-0218 (the conversion/locale boundary); ADR-0219
      (the float→fixed conversion and its re-pin).
- [x] `.ai/reports/u-1-canonical-values.md` exists with exact commands and
      observed results (not summaries).
- [x] `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the
      exact commit; clean working tree; Conventional Commit subjects.

## Resolution (U-1 ticket 08)

Acceptance pass complete, recorded in `.ai/reports/u-1-canonical-values.md`.
The six `.ai/SPRINT-PLAN.md` U-1 criteria are traced to the named tests/gates in
the report; the five implementation ADRs above are recorded and indexed; the
full `pnpm check` gate is green (build, lint, format, licences, typecheck,
content verify, full recursive test suite, balance reports, golden 11/11,
cross-process determinism byte-identical, equivalence determinism, desktop E2E
30/30).
