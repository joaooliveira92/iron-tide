# ADR-0365: Verification gates and infrastructure

Consolidates: ADR-0227, ADR-0238, ADR-0267, ADR-0274, ADR-0275, ADR-0299, ADR-0300, ADR-0335

Applies to: repository

Rule: Verification gates enforce golden-repin discipline, reachability, toolchain integrity and agent scoped checks under `pnpm heavy` serialisation; pipeline artifacts are GitHub Issues; unreachable combat modules stay dormant.

## Status

Accepted (2026-10-30).

Supersedes: ADR-0227
Supersedes: ADR-0238
Supersedes: ADR-0267
Supersedes: ADR-0274
Supersedes: ADR-0275
Supersedes: ADR-0299
Supersedes: ADR-0300
Supersedes: ADR-0335

## Context

Several independent verification mechanisms accumulated in the repository: a golden re-pin guard at commit time, a reachability ledger to map every engine capability to a player verb, a tsgo toolchain integrity check, a machine-wide gate serialiser to prevent contention across worktrees, an agent navigation and scoped verification tool, and a policy of keeping pipeline artifacts on GitHub Issues instead of local markdown. Each addressed a distinct failure mode and was enforced at different points in the development workflow (commit hook, preflight, CI). This ADR consolidates them under a unified verification infrastructure.

## Rules

1. **Pipeline tracking on GitHub.** Pipeline artifacts (wayfinder map, spec, tickets) live as GitHub Issues on `joaooliveira92/iron-tide`. The map is one issue labelled `wayfinder:map`; its decision tickets are child issues labelled `wayfinder:<type>`. The spec is one issue labelled `ready-for-agent`; its implementation tickets are sub-issues of the spec issue carrying the same label and native GitHub blocking dependencies. `docs/agents/issue-tracker.md` is the operational authority. `.ai/specs/` is retired; `.scratch/` is frozen as historical provenance. (ADR-0227)

2. **Golden re-pin guard at commit time.** The `commit-msg` hook runs `scripts/check-golden-repin-staged.mjs`, which applies the existing `commitNeedsRepin` predicate to the staged paths and the message being written, and refuses the commit with documented remedies. Merge, revert, `fixup!` and `squash!` commits are skipped. No path exemptions are added and `REFERENCE_RUN_EXEMPTIONS` is unchanged. `pnpm check` keeps the range guard as the backstop for `--no-verify` and for commits made outside the hook. (ADR-0238)

3. **Reachability ledger.** Every engine capability maps to a player verb in `scripts/data/reachability-ledger.json` (engine entry, main command from `CAMPAIGN_COMMAND_NAMES`, renderer screen, evidence test). Four statuses exist: `reachable` (requires a checkable path: a command in `CAMPAIGN_COMMAND_NAMES` with a handler in `campaignBridge.ts` and a call site in non-test renderer source, a `renderer_screen` that exists and is not registered only under `DEBUG_MODE` or `import.meta.env.DEV`, and an `evidence_test` that exists and names one of the row's commands or its screen), `dormant-by-decision` (cites ADRs or issues as `ADR-NNNN` / `#N` which must resolve), `internal` (not player-facing by nature), and `unclassified` (always a gate failure). The gate classifies every combat module, every phase-engine index module and exported `apply*` verb, and every `CAMPAIGN_COMMAND_NAMES` entry. Adding an export, module, verb or command without classifying it fails `pnpm preflight` and `pnpm check`. Removing a screen, command handler, call site or test that a `reachable` row cites fails the same gates. `docs/reachability-report.md` is generated from the ledger; the gate fails when the report drifts. (ADR-0267)

4. **Scratch tree removed.** `.scratch/` is deleted from the working tree; its contents stay recoverable from git history. No live source, configuration or standing doc cites it. The `.scratch/**` ignore patterns in `vite.config.ts` and the `.scratch/handoff/` line in `.gitignore` are dropped. (ADR-0274)

5. **Tsgo toolchain gate.** The gate checks that root `package.json` pins for `@effect/tsgo`, `typescript`, `oxlint` and `oxlint-tsgolint` equal the installed package versions, and that each patched binary has its `.original` backup. Compatibility between those versions is enforced by `effect-tsgo patch` at install. The gate no longer carries a hand-written support matrix. (ADR-0275)

6. **Gate serialisation.** `pnpm heavy` (`scripts/heavy.mjs`) runs a command under a machine-wide lock directory (`/tmp/bluewave-heavy.lock` with holder pid and command recorded) and caps `VITEST_MAX_WORKERS` at 4 unless set. A second run waits and names the holder. A lock whose holder process is gone, or that never recorded a holder and is older than ten seconds, is reclaimed. A run launched by a process that already holds the lock proceeds (no deadlock on wrapping). Before starting, it prints a warning when the one-minute load average exceeds the core count. `pnpm check` is `node scripts/heavy.mjs pnpm check:steps`; the step chain moved unchanged to `check:steps`, and the CI parity gate reads `check:steps`. `pnpm heavy <cmd>` wraps any other long run. On Windows the lock lives under the OS temp directory and ancestor detection is skipped. (ADR-0299)

7. **Dormant combat modules.** Unreachable combat modules stay dormant until their roadmap owner wires them. No module is retired and none is wired now — wiring waits for the roadmap item that owns it (mines: W-2 after W-1; submarines: W-2; coastal-defense: W-5/F-3; smoke: T-2; air-combat/air-defense: E-1 ticket from #280; carrier-operations: the same ticket plus remaining technology ids). The UI must not expose dormant modules while they remain unwired. The seven reachability-ledger rows that cited #225 now cite this ADR. (ADR-0300)

8. **Agent navigation and scoped verification.** `scripts/agent-map.mjs` reports the owning workspace, applicable instructions and by-scope rules, exports, definition sites, bounded call sites, candidate tests, validation commands, change state and golden guidance for a symbol or path. It exits 3 on ambiguity and 4 when nothing matches. `scripts/verify-affected.mjs` consumes the change-scope report and runs build, typecheck, tests and lint for changed workspaces plus their reverse dependencies under a single `pnpm heavy` lock. Shared root configuration and unowned paths widen to full scope; docs, scripts, content and goldens map to their own units. It is a fast inner loop, not a replacement for `pnpm check`. The root `AGENTS.md` names the three commands (`agent:map`, `verify:affected`, `heavy`) inside its existing word budget. (ADR-0335)