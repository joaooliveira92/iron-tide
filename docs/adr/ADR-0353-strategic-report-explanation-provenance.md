# ADR-0353: Provenance for strategic-area and monthly-report explanations

Consolidates: ADR-0307

Applies to: campaign, campaign-engine, desktop

Rule: Every displayed number derives its explanation from stored components or the rule that produced it; report trees are additive persisted fields outside the authoritative hash.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0307

## Context

The first batch of explanation trees (ADR-0304) covered economy, research, construction and fleet numbers from the same calculation that produced each displayed value. Two areas remained: diplomacy/war/prestige/priorities (issue #304) and turn reports/messages (issue #306). Their displayed numbers looked like aggregates with no replayable formula in the view:

- Prestige is an accumulated value; the projection carried only the last change's before/after/delta.
- Tension and war score are accumulated relation/war state without a stored contribution history.
- Priorities are text entries whose numeric ranking keys are not displayed.
- Report totals are projections of the month's ledger, reconciliation, and domain events.

The batch report left these open rather than inventing provenance.

## Rules

1. **Honest provenance.** A displayed number is explained only from stored components or the rule that produced it. When the state holds only a total, the area stays exempt with a reason; a tree is not built by guessing the components.

2. **Prestige.** The honest source is the applied prestige rule. `PrestigeLastChange` records `appliedRule` (the rule actually used, including an explicitly supplied declined-battle rule), `unclampedAfter` (the target before the bounds clamp), and `bounds`. Both fields are additive and optional: a last change written before this ADR decodes unchanged and simply omits the disclosure, so no compatibility bump is required. The only authoritative writer, `applyPrestigeChange`, records them from `applyPrestigeRuleDetail`, whose arithmetic is the same path `applyPrestigeRule` uses. `explainPrestigeChange` builds `prestige_change` as `before + rule line + clamp line = after`; the clamp line appears only when the rule left the bounds. `PlayerProjectionPrestige` carries it as `changeExplanation` (additive, omitted when absent), and the status-strip prestige card renders it in the shared disclosure with `strategic.prestige_change.*` labels.

3. **War score and tension exemptions.** These are accumulated state with no stored contribution ledger. An honest tree needs a recorded contribution history (battle result and blockade month deltas, or relation last-change sources). That is a future authoritative state change, not a presentation slice. They remain exempt with that reason.

4. **Priorities exemption.** The player-readable explanation is the existing `StrategicPriority.reason` engine trace. `financialRisk` and `timeToConsequence` are internal ranking keys and are not displayed; they get no tree. The opening briefing's numbers re-export the economy, construction, and fleet projections and reuse those areas' trees and formulas; the briefing gets no duplicate formula.

5. **Monthly report treasury.** A report number's provenance is the month's ledger and reconciliation, not a new report-level aggregate. `MonthlyReportTreasury.treasuryExplanation` (`report_treasury`) is built by `reconcileMonthLedger` at report creation and sums opening, revenue, construction, preservation, maintenance, obligations, research, and the signed other movement to the displayed closing balance. Construction and research progress entries are projections of `ConstructionProgressed` and `ResearchProgressed`; the event is their provenance.

6. **Persistence.** The report tree is an optional field on the persisted reports sidecar. Reports written before this ADR decode unchanged and omit the disclosure; the field is not part of any authoritative snapshot, replay, or save hash.

## Consequences

- `scripts/data/explanation-coverage.json` moves from 19/210 (9.04%) to 20/211 (9.47%) with the recorded rule change.
- No authoritative hash moves; the reports sidecar change is additive and backward compatible.
- Issue #304 remains open for the prestige-rule record and any future war-score/tension contribution ledger; issue #306 closes on the reconciliation tree with its remaining event-derived exemptions.
- The recorded rule changes the snapshot bytes of a month that applies prestige; the replay was re-recorded and approved as `SERIALIZATION_ONLY`; no gameplay outcome, golden hash, or other replay moved.