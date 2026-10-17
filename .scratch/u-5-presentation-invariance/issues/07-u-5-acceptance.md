# 07: U-5 acceptance

**What to build:** The evidence that U-5 is real on a clean commit: all sixteen
acceptance clauses trace to named tests/gates, the invariance suite drives the real
composition, and the sprint meets its definition of done.

**Blocked by:** 01, 02, 03, 04, 05, 06.

**Status:** ready-for-agent

- [ ] The standing invariance suite passes and proves no preference moves an
      authoritative hash (record the before/after reference hashes as evidence).
- [ ] All sixteen `.ai/SPRINT-PLAN.md` U-5 clauses trace to a named test/gate.
- [ ] No save format, wire format, or compatibility version changed; no golden hash
      moved.
- [ ] The U-5 validation report is written with exact commands and observed results;
      the SPRINT-PLAN row and the `.ai/specs/` pointer are updated; the tree is clean
      with Conventional Commit subjects.
- [ ] `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the exact
      commit.
