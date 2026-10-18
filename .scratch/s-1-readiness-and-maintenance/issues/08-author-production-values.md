# 08: Author production values

**What to build:** The ruleset constants S-1 introduced are set to sourced production
values — active maintenance rate, reserve/mothballed/wartime multipliers, crew
ceilings and ramp, the working-up threshold — with provenance recorded, and the
reference run re-pinned with a stated cause.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07. Decision request **0007** is resolved
(2026-10-17, Option A) and the golden baseline exists, so only the structural
tickets block this.

**Status:** done (2026-10-17) — every S-1 constant is centralized with provenance
(ADR-0223); the per-constant provenance table is in
`docs/research/s-1-readiness-and-maintenance.md`. The reference output does not
change, so no re-pin is required.

- [x] Decision request 0007 is resolved and recorded as an ADR with provenance
      (ADR-0223; adopted values recorded in the provenance table).
- [x] Every constant has a cited source or an explicit balance-target marker; none is
      presented as a manual fact.
- [x] The production ruleset compiles and the values are read by the phase.
- [x] Goldens are re-pinned only if observable output changes — it does not, so the
      goldens stay pinned (`pnpm check:golden`: 11/11).
