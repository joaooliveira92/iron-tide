# Autonomy and access

What an agent may do alone, what needs a human, and which machines and accounts
may run agents here (ADR-0367).

## Permissions by task type

| Task type | May do alone | Stops at |
| --- | --- | --- |
| Review, triage, investigation | Read, run read-only commands, file issues | Report |
| Low-risk implementation | Edit, test, commit on its branch, open a PR if the brief allows | `ready-for-review` |
| High-risk implementation (ADR-0367 rule 6) | Same, plus request independent review | `ready-to-merge` unless merge is authorized |
| Merge | Merge into `dev` under ADR-0367 rule 7 | Any failed condition |

Grant the least the task needs. Review agents never edit, commit, branch, or
change PR state.

## Always needs a human

- Production, signing or publishing credentials; reading or writing secrets.
- Tagging, publishing or unpublishing a release; merging into `main`.
- Billing, plan or provider-account changes.
- Publishing a package or dependency.
- Irreversible data migration, save-format breaks, history rewrite, force-push.
- Destructive infrastructure or repository-settings changes.
- Merging a high-risk change when the brief does not grant merge authority.
- Any permanent stop condition in `AGENTS.md`.

## Triage work agents do well

Summarise an unfamiliar PR before human review. Compare a PR with its issue and
acceptance criteria. Find stale branches (`pnpm worktrees audit`), stale PRs,
duplicate or obsolete issues, doc/code disagreement, and recurring gate
failures. Rank work by impact, urgency, effort, risk and dependency, with
evidence. Turn findings into issues. Humans set product priority.

## Provider and account use

- Use each AI provider only under the plan and client its current terms permit
  for the workload. Use API or team plans for unattended automation or
  shared access. When a workflow is ambiguous, ask the provider in writing.
- One identity per person or service. Never rotate, pool, share or resell
  personal accounts, proxy traffic to hide its origin, centralise tokens to hide
  usage, or route one product's credentials into an unsupported client.
- Opting out of training does not change what a plan permits.
- Set budget alerts instead of using up quota because it is there. Keep billing
  and activity records.
- The owner keeps a private register of approved models, clients, integrations
  and auth methods, and re-checks it when tools or terms change.
- Before an agent touches mail, browsers, dashboards or personal data, do a
  privacy review. Then grant narrow, short-lived, revocable access.

## Machines that run agents

Machine provisioning lives outside this repository, in the owner's private
fleet repository. Before a machine runs tasks here, it must have:

- a supported OS with automatic security updates and disk encryption;
- key-only SSH (no passwords), per-user keys, and access only over a private or
  zero-trust network, with app-level auth on every service;
- default-deny firewall, with services bound to the interfaces they need;
- secrets in a secret manager or protected environment, never in Git; keys
  revoked when the machine retires;
- agents running as a non-privileged user, with CPU, memory, disk and time limits;
- logs of logins, task runs and admin changes, and backed-up task metadata;
- a verify script that confirms Node, pnpm and Git versions match
  `package.json` and that `pnpm preflight` passes on a fresh clone.

## Resource limits on one machine

- At most five checkouts (ADR-0364). Long gates run through `pnpm heavy`, one at
  a time per machine, with Vitest capped at four workers (ADR-0365 rule 6).
- `heavy` warns when load exceeds the core count. Do not start another gate
  then; queue it.
- Do not start work with under 10 GB free disk. `pnpm worktrees prune` reclaims
  merged checkouts.
- Kill orphaned dev servers and Electron processes before closing a task. Keep
  failed-gate logs (`node_modules/.cache/bluewave-verify/`) until the task closes.
- Use CI for full cross-OS runs. Do not reproduce them locally.
