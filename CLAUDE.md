@AGENTS.md

- Standing user authorization: use the `search`, `grep`, `audit`, `runner` subagents (`.claude/agents/`) without asking, for repo-wide searches, call-site hunts, diff audits, and test runs over ~30 s. They return paths, one-line summaries, or failures only.
- Start from the handoff or brief if one is given; do not re-derive what it states.
- Context cap: hooks warn at 150k tokens and block a resume above 200k (`scripts/data/agent-context-policy.json`). At the warning, commit and write the handoff (`handoff` skill). [Context efficiency](docs/agents/context-efficiency.md).
