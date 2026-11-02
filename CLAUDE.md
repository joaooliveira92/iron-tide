@AGENTS.md

- Standing user authorization: use the `search`, `grep`, `audit`, `runner` subagents (`.claude/agents/`) without asking, for repo-wide searches, call-site hunts, diff audits, and test runs over ~30 s. They return paths, one-line summaries, or failures only.
- Start from the handoff or brief if one is given; do not re-derive what it states. AGENTS.md is already loaded: do not cat it.
- Context cap: hooks warn at 150k tokens and block a resume above 200k (limits in `scripts/data/agent-context-policy.json`). At the warning finish the step, commit, write the handoff ([template](.ai/templates/handoff.md), `handoff` skill), and recommend a fresh session. Details: [context efficiency](docs/agents/context-efficiency.md).
