# Agent patterns

Reusable patterns for the agents that work in this repo. They are packaged as
skills under `.agents/skills/` (mirrored into `.claude/skills` by
`scripts/link-claude-skills.mjs`) and driven by the orchestration pipeline in
`.ai/ORCHESTRATION.md`:

| Pattern | Skill |
| --- | --- |
| Chart a foggy effort | `wayfinder` |
| Turn talk into a spec | `to-spec` |
| Slice a spec into tickets | `to-tickets` |
| Ground content in sources | `research` |
| Test-first work | `tdd` |
| Sharpen a design | `grilling` |

Keep one pattern per skill, one purpose per agent.

## Effect usage patterns

Example-rich references for writing Effect code in this repo, derived from the
vendored source (`vendor/effect`). Read the relevant file before writing that
kind of code.

| Concern | File |
| --- | --- |
| Boundary validation | `effect-schema.md` |
| Error taxonomy | `effect-errors.md` |
