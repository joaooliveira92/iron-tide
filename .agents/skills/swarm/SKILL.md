---
name: swarm
description: "Fan out N parallel subagents, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration partitions."
disable-model-invocation: true
---

# Swarm

Fan out N parallel subagents. They may cover separate slices, race the same
brief, or mix both. The parent frames the work, spawns the workers, waits,
aggregates, and returns one report.

## Start

Open a plan with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the **done predicate** and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs,
   or mix both. For a race or mixed shape, declare the selection rule (`first
   pass`, `rank all`, or `best-of`) before spawning.
3. Set N from the operator or derive it from the shape.
4. Pick the model per role. Use the default subagent model unless the operator
   named one. Verification stays on a fast worker model.
5. Give each worker its own writable output when it writes. When workers report
   line-level evidence, each brief names the exact paths and the evidence format.
   A measurement brief also names the method (sample count, what one sample is,
   order) and the worker records it in its result.

## Phase B: Fan out

- Spawn all N workers **in one message** (parallel `Task` tool calls) so they run
  concurrently. Use `subagent_type: "general"` for judgment work and `explore`
  for pure reconnaissance.
- Every brief stands alone. Include the goal, the exact scope (paths/globs), how
  to verify, and the required report format.
- Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can
  prove a defect reports `ISSUES` and lists every item it can prove, not only the
  first.
- If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

- Read the terminal results. Drop a result that does not supply the evidence
  format its brief named, and respawn that worker once. After a second miss,
  record a gap. A gap does not count as a pass.
- For coverage, every required slice needs a result. For a race, apply the
  selection rule declared up front.
- Do not paste raw worker dumps. Keep a compact result table, one-line evidenced
  items, and explicit gaps or dropouts.
- Re-read a sample of the claimed sites yourself before trusting the report.

## Phase D: Report

Return one consolidated in-chat report with the table, one-line items, gaps or
dropouts, and the selection rule when one was used.
