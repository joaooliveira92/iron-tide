# ADR-0267: The reachability ledger maps engine capability to desktop path

Applies to: repository

## Status

Superseded by: ADR-0365

Accepted (2026-10-21). Implements ticket [#228](https://github.com/joaooliveira92/iron-tide/issues/228) of epic
[#220](https://github.com/joaooliveira92/iron-tide/issues/220).

## Context

Capability kept landing in `packages/*` with no route to a screen, and the only record of the gap was prose in
`.ai/SPRINT-PLAN.md` that nothing checked. The shipping bar says the player's experience is the product.

## Decision

1. **The unit is the player verb, backed by exports.** A ledger row is one thing a player does or reads
   ("declare war", "fight a battle"), not one export. The exports behind it are listed on the row (`engine_modules`,
   `engine_symbols`), so every export is still accounted for.
2. **One machine-readable ledger.** `scripts/data/reachability-ledger.json` (version 2) is the source of truth. Each row
   carries the path `engine entry -> main command (CAMPAIGN_COMMAND_NAMES) -> renderer screen -> evidence test`.
   `docs/reachability-report.md` is generated from it with `node scripts/verify-reachability-ledger.mjs --write`; the
   gate fails when the report drifts. `.ai/SPRINT-PLAN.md` points at the report and no longer states the status.
3. **Four statuses.** `reachable`, `dormant-by-decision` (cites ADRs or issues as `ADR-NNNN` / `#N`, which must
   resolve), `internal` (not player-facing by nature) and `unclassified` (always a gate failure).
4. **A row cannot claim `reachable` without a checkable path.** It needs at least one main command; every command must
   be in `CAMPAIGN_COMMAND_NAMES`, have a handler in `campaignBridge.ts` and a call site in non-test renderer source; a
   `renderer_screen` that exists and is not registered only under `DEBUG_MODE` or `import.meta.env.DEV`; and an
   `evidence_test` that exists, is a test file and names one of the row's commands or its screen.
5. **Classification is exact.** The gate classifies every `combat` module (index re-exports and top-level source
   modules), every `phase-engine` index module and every exported `apply*` verb, and every `CAMPAIGN_COMMAND_NAMES`
   entry. Matching is by exact name (no substrings), each item is classified by exactly one row of its package, and a
   row naming something that no longer exists fails.
6. **Later issues move rows.** #221-#227 change a row's status in the same change that delivers the path; the gate
   proves the path exists. The strict schema rejects unknown keys.

## Consequences

- Adding an export, module, verb or command without classifying it fails `pnpm preflight` and `pnpm check`.
- Removing a screen, command handler, call site or test a `reachable` row cites fails the same gates.
- The gate checks that the path exists, not that the evidence test passes; the test suites do that.
- The evidence test may be an end-to-end spec. Those are checked for existence only here.
