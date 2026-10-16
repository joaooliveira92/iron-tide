# 08: Author production values

**What to build:** The ruleset constants S-1 introduced are set to sourced production
values — active maintenance rate, reserve/mothballed/wartime multipliers, crew
ceilings and ramp, the working-up threshold — with provenance recorded, and the
reference run re-pinned with a stated cause.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07. Also gated by decision request 0007
(values) and 0005 (golden baseline).

**Status:** blocked

- [ ] Decision request 0007 is resolved and recorded as an ADR with provenance.
- [ ] Every constant has a cited source or an explicit balance-target marker; none is
      presented as a manual fact.
- [ ] The production ruleset compiles and the values are read by the phase.
- [ ] Goldens are re-pinned in the same commit with cause "S-1 production readiness
      values"; old/new hashes recorded.
