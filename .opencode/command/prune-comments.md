---
description: "Prune useless code comments: run poteto-mode, fan out a comment-sicko swarm over the repo, and return a plan splitting findings into refactor-first and delete-outright. Pass optional paths/globs to scope it ($ARGUMENTS)."
agent: comment-pruner
---

Launch the **comment-pruner** project agent to find useless code comments and
return a high-level pruning plan.

Scope: `$ARGUMENTS`. If empty, run the default full-repo partition named in the
agent file (excluding `vendor/**`, `repos/**`, `**/dist/**`, `**/node_modules/**`,
`**/.turbo/**`, `content/generated/**`).

Follow the agent's Run steps exactly. Adopt **poteto-mode**, use the **swarm**
skill phases, and hand each worker the **no-comments** rubric. This is an
**analysis**: return the plan in chat and, if useful, write it to
`.scratch/comment-pruning/plan.md`. Do not apply edits or commit unless the
operator asks.
