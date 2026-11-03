---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use at the 150k-token warning, a usage-limit warning, or a finished slice.
argument-hint: "What will the next session be used for?"
---

Write a handoff so a fresh agent can continue without rescanning the repository.

1. Commit the work first. Put durable decisions in the task brief (`.ai/briefs/<slug>.md`) or the issue; the handoff links to them.
2. Fill `.ai/templates/handoff.md` and save it to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`), as `handoff-<slug>.md`, not in the workspace.
3. Run `node scripts/verify-agent-context.mjs --handoff <file>` and fix it until it passes (required sections, word limit from `scripts/data/agent-context-policy.json`).
4. Add a "suggested skills" line naming skills the next agent should call.
5. Do not duplicate specs, plans, issues, commits or diffs: reference them by path or URL. Redact secrets and personal data.
6. Tell the user to start a fresh session with the file as its first message. Never resume a thread above the block limit.

If the user passed arguments, treat them as the focus of the next session.
