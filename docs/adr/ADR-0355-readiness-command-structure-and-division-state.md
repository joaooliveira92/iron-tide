# ADR-0355: Readiness, Command Structure and Division State

Consolidates: ADR-0223, ADR-0224, ADR-0298, ADR-0296

Applies to: content, campaign, cross-process-test, commands, phase-engine, desktop, campaign-engine

Rule: Every numeric gameplay value for readiness, crew and maintenance is a centralized ruleset constant with provenance; per-nation officer rosters and seeded divisions are authored balance choices; command-lifecycle scaffolding is removed from shipping code; ship conditions are derived predicates computed from existing fields.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0223
Supersedes: ADR-0224
Supersedes: ADR-0298
Supersedes: ADR-0296

## Context

S-1 gave every commissioned ship a readiness state (`ACTIVE`/`RESERVE`/`MOTHBALLED`/`WORKING_UP`/`REPAIR`), a crew quality, monthly maintenance by state, costs repair at about twice active, raises wartime maintenance, and excludes working-up ships from battle. The manual states the rules but almost none of the numbers. Values were scattered literals — `floor(hitPoints * 10 / 100)` in economy phases, a duplicated copy in opening-briefing and projection, the neutral crew band `AUTO_TORPEDO_CREW_QUALITY_BP`, and a hard-coded battle readiness of `80` in battle phases. ADR-0223 centralized every numeric gameplay value as a named, provenance-carrying ruleset constant with grounded rules preserved, following the pattern of ADR-0213. Values that could not be grounded were returned to the owner rather than guessed.

N-1 ticket 07 seeds the 1880 opening command structure. ADR-0224 authored per-nation officer rosters and seeded 1880 divisions with explicit `balance_adjustment` provenance. The officer-roster half moved the reference golden and was re-pinned in the same behavioural commit. The seeded-divisions half was reference-inert because the cross-process reference run's fixture declares no `divisions` collection.

ADR-0298 found that hash-chained command-lifecycle records, settlement branches (completion, pre-lock cancellation refund) and audit-chain heads against a snapshot were scaffolding for an unscheduled feature — no shipping path, save, replay or screen reads them. Only `createCommandRecord` is used. The seven spec-rule helpers with no caller and the `settlementPolicy` block on `BUDGET_PROJECT_COMMAND_DEFINITION` were removed.

ADR-0296 defined `deriveShipConditions` returning an ordered subset of `UnderStrength`, `Detached`, `Damaged`, `OutOfAction` from existing ship fields. Conditions are computed on read, never stored, and labelled through the message catalogue. Crew ceilings, the monthly ramp and the maintenance multiplier stay owned by the primary readiness state.

## Rules

1. **Readiness constants are centralized.** Every numeric gameplay value for readiness, crew and maintenance is a named, centralized ruleset constant with provenance. No numeric gameplay constant may be embedded directly in `economyPhases.ts`, `battlePhases.ts`, `opening-briefing`, `projection`, or `torpedoProjection.ts`. The hard-coded battle-readiness value `80` is removed and read through the centralized ruleset mechanism.

2. **Grounded readiness rules are preserved.** Repair costs approximately twice active maintenance and mothballing halts repair and its premium; mothballed maintenance is half (`mothballedMaintenancePerMonthMicro` / `preservationCostBp`); the `ACTIVE`/`RESERVE`/`MOTHBALLED`/`WORKING_UP`/`REPAIR` states remain distinct; working-up ships cannot fight.

3. **Single-sourced maintenance.** Maintenance, readiness, projection and opening-briefing consume the same authoritative constants, so the three current maintenance copies cannot diverge.

4. **Value provenance.** Values are grounded by high-trust research where possible; any value that cannot be grounded may be selected only as an explicitly labelled ADR-0213 `balance_adjustment` (with `sourceStatus: BALANCE_TARGET`), covered by deterministic tests and designed for later tuning. Values the sources omit are never presented as sourced facts. Retuning changes constants, not the model or phase code.

5. **Golden re-pinning.** Goldens are re-pinned only when observable deterministic output actually changes, using the established same-commit procedure (`docs/agents/golden-repinning.md`). The `not-needed` trailer records when the change verifiably does not move the reference output (e.g., seeded divisions in a fixture with no `divisions` collection).

6. **Per-nation officer rosters and seeded divisions.** Per-nation officer rosters and seeded 1880 divisions are authored as explicit ADR-0213 `balance_adjustment` values with provenance; directions follow citable history, magnitudes are admitted balance choices, never sourced facts. Roster and division magnitudes are authored content, not engine defaults.

7. **NationState compatibility.** The `NationState` compatibility-version impact is assessed explicitly for each change: either a deterministic migration is implemented or incompatible prior saves are deliberately refused, per the repository's existing compatibility policy.

8. **Command-lifecycle scaffolding.** Only `createCommandRecord` ships (used by `apps/desktop`). The seven spec-rule helpers with no caller anywhere (`enforceLockImmutability`, `checkCancellationWindow`, `produceResult`, `handleImpossibility`, `assertNoDirectMutation`, `handleInternalFailure`, `verifyReplay`) are removed. `AuditChain` stays because `CommandLifecycle` uses it. `BUDGET_PROJECT_COMMAND_DEFINITION` drops its `settlementPolicy` block; `settlementPolicyId` stays as a required definition field. If a settlement or refund feature is ever scheduled, it returns through a new ADR and a test through the month pipeline, not as unreferenced helpers.

9. **Ship conditions are derived predicates.** `deriveShipConditions` returns an ordered subset of the closed list `UnderStrength`, `Detached`, `Damaged`, `OutOfAction`. A hull under construction has none.
   - `UnderStrength`: crew quality below the ceiling of the ship's own readiness state.
   - `Detached`: the ship holds a foreign-station assignment. An exercise is not a detachment.
   - `Damaged`: hit points below the maximum, or `availability` of `DEGRADED`.
   - `OutOfAction`: `availability` of `UNAVAILABLE`, or readiness `REPAIR`.

10. **Conditions are unstored.** Conditions are computed on read from existing ship fields. Crew ceilings, the monthly ramp and the maintenance multiplier stay owned by the primary readiness state; a condition never changes them. No wire format or compatibility version changes.

11. **View and rendering.** `FleetShipView.conditions` carries the list and is omitted when empty. The renderer labels each code through the message catalogue (`fleet.condition.*`) and never recomputes a rule. Battle history renders gate reason codes through `fleet.absence.*` and `battle.history.absent*` catalogue keys.

## Compatibility

Officer-roster changes move reference goldens with an understood, attributable cause. The `NationState.divisions` field is reference-inert when the cross-process fixture declares no `divisions` collection, so only the committed content lock moves. Command-lifecycle changes affect no wire format, state, hash or replay (the definition's `contentHash` is derived from type id and version only). Ship conditions use no new wire format; the `FleetShipView.conditions` field is additive and omitted when empty. All 11 golden hashes and 13 replays verify unchanged for the scaffolding removal and ship condition changes.