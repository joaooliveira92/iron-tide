# 08: U-1 acceptance

**What to build:** The U-1 acceptance pass: all six `.ai/SPRINT-PLAN.md` U-1
criteria traceable to named tests/gates, the implementation ADRs recorded and
indexed, and the full validation gate green on the exact commit.

**Blocked by:** 02, 03, 04, 05, 06, 07.

**Status:** blocked

- [ ] All six U-1 acceptance criteria — canonical unit table; fixed-precision
      integer monetary representation; rounding and number-formatting boundaries;
      UI language vs formatting locale separate; float/display-leakage audit;
      conversion only at the application boundary — are traceable to named tests
      or gates.
- [ ] The implementation ADRs are recorded and indexed (`pnpm adr:index`):
      canonical unit table and its home; money type, scale and the single bridge
      rounding mode; rounding/fixed-point rules and the float gate; the
      conversion/locale boundary; the float→fixed conversion and its re-pin.
- [ ] `.ai/reports/u-1-canonical-values.md` exists with exact commands and
      observed results (not summaries).
- [ ] `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the
      exact commit; clean working tree; Conventional Commit subjects.
