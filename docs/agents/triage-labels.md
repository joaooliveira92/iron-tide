# Triage labels

Issues and external pull requests move through a small state machine. Every
triaged item carries **exactly one category** and **exactly one state**. A PR is
an issue with attached code and uses the same vocabulary. The `triage` skill
drives this; it also writes agent-ready briefs.

## Categories

| Role | Meaning |
| --- | --- |
| `bug` | Something is broken. |
| `enhancement` | A new feature or improvement. |

## States

| Role | Meaning |
| --- | --- |
| `needs-triage` | A maintainer needs to evaluate it. |
| `needs-info` | Waiting on the reporter for more information. |
| `ready-for-agent` | Fully specified; ready for an AFK agent. |
| `ready-for-human` | Needs human implementation. |
| `wontfix` | Will not be actioned. |

For a PR, the states read against the diff: `ready-for-agent` means a brief is
attached and an agent should take the next step; `ready-for-human` means it is
ready for a human to merge.

## Transitions

An unlabelled item normally starts at `needs-triage`, then moves to `needs-info`,
`ready-for-agent`, `ready-for-human`, or `wontfix`. `needs-info` returns to
`needs-triage` once the reporter replies. The maintainer may override at any
time; flag unusual transitions before acting.

These are canonical role names — the label strings in a given tracker may differ
(see [issue tracker](issue-tracker.md)). Every comment posted during triage must
start with the AI disclaimer the `triage` skill specifies.
