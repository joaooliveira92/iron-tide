# 09: S-2 acceptance run

**What to build:** A scripted 1880 campaign from the production pack proves the
whole sprint: prestige moves from real sources, a player pushed below the
threshold is sacked deterministically, and a surviving player reaches a scored
horizon. Produces the validation report.

**Blocked by:** 03, 04, 05, 06, 07, 08

**Status:** ready-for-agent

- [ ] Production 1880 compiled campaign: each S-2 source is observed at least once
      in a scripted run.
- [ ] A scripted run reaches SACKED and another HORIZON_REACHED, both
      byte-identical across two processes.
- [ ] `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the
      exact commit.
- [ ] Validation report written to `.ai/reports/` with observed results; the S-2
      sprint-plan row marked done with a pointer.
