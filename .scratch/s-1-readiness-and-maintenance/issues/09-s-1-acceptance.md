# 09: S-1 acceptance run

**What to build:** A scripted 1880 campaign from the production pack proves the whole
sprint: a ship works up and joins the fight, a fleet economises with reserve and
mothball, a repairing ship costs double and can be mothballed to stop it, and war
raises the bill — all deterministic across two processes. Produces the validation
report.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08

**Status:** done (2026-10-17) — acceptance test in
`packages/cross-process-test/test/production-pack-loop.test.ts`; report in
`.ai/reports/s-1-readiness-and-maintenance.md`.

- [ ] Production 1880 compiled campaign: each S-1 mechanic is observed at least once
      in a scripted run.
- [ ] Two cross-process runs are byte-identical; the golden hashes match the
      committed baseline.
- [ ] `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the exact
      commit.
- [ ] Validation report written to `.ai/reports/` with observed results; the S-1
      sprint-plan row marked done with a pointer.
