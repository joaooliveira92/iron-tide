# ADR-0307: Provenance for strategic-area and monthly-report explanations

Applies to: campaign, campaign-engine, desktop

## Status

Superseded by: ADR-0353

Accepted (2026-10-26). Continues [ADR-0304](ADR-0304-explanation-trees-for-displayed-numbers.md) for
[#304](https://github.com/joaooliveira92/iron-tide/issues/304) and
[#306](https://github.com/joaooliveira92/iron-tide/issues/306). Does not fabricate trees for accumulated
state.

## Context

The first area batch explained economy, research, construction and fleet numbers from the same
calculation that produced each displayed value. Two areas remained: diplomacy/war/prestige/priorities
(#304) and turn reports/messages (#306). Their displayed numbers looked like aggregates with no
replayable formula in the view:

- prestige is an accumulated value; the projection carried only the last change's before/after/delta;
- tension and war score are accumulated relation/war state without a stored contribution history;
- priorities are text entries, and their numeric ranking keys are not displayed;
- report totals are projections of the month's ledger, reconciliation and domain events.

The batch report left them open rather than inventing provenance.

## Decision

1. **A displayed number is explained only from stored components or the rule that produced it.**
   When the state holds only a total, the area stays exempt with a reason; a tree is not built by
   guessing the components.
2. **Prestige (#304).** The honest source is the applied prestige rule. The next slice adds the
   applied rule to `PrestigeLastChange` as an additive, versioned state field (compatibility bump and
   parity test), then builds `prestige_change` as `before + rule delta = after` with the bound clamp
   recorded. The reason code names the trigger. Until that field exists, the area remains exempt
   rather than reconstructing a rule from the recorded total.
3. **War score and tension (#304).** These are accumulated state with no stored contribution
   ledger. An honest tree needs a recorded contribution history (battle result and blockade month
   deltas, or relation last-change sources). That is a future authoritative state change, not a
   presentation slice. They remain exempt with that reason.
4. **Priorities (#304).** The player-readable explanation is the existing `StrategicPriority.reason`
   engine trace. `financialRisk` and `timeToConsequence` are internal ranking keys and are not
   displayed; they get no tree.
5. **Opening briefing (#304).** Its numbers re-export the economy, construction and fleet
   projections. They reuse those areas' trees and formulas; the briefing gets no duplicate formula.
6. **Monthly reports (#306).** A report number's provenance is the month's ledger and
   reconciliation, not a new report-level aggregate. `MonthlyReportTreasury.treasuryExplanation`
   (`report_treasury`) is built by `reconcileMonthLedger` at report creation and sums opening,
   revenue, construction, preservation, maintenance, obligations, research and the signed other
   movement to the displayed closing balance. Construction and research progress entries are
   projections of `ConstructionProgressed` and `ResearchProgressed`; the event is their provenance.
7. **Persistence.** The report tree is an optional field on the persisted reports sidecar. Reports
   written before this ADR decode unchanged and omit the disclosure; the field is not part of any
   authoritative snapshot, replay or save hash.

## Implementation (2026-10-26, batch 3)

`PrestigeLastChange` now records `appliedRule` (the rule actually used, including an explicitly supplied
declined-battle rule), `unclampedAfter` (the target before the bounds clamp) and `bounds`. Both fields are optional
and additive: a last change written before this ADR decodes unchanged and simply omits the disclosure, so no
compatibility bump is required (the precedent is [ADR-0281](ADR-0281-sacking-phase-and-terminal-career.md)). The
only authoritative writer, `applyPrestigeChange`, records them from `applyPrestigeRuleDetail`, whose arithmetic is
the same path `applyPrestigeRule` uses.

`explainPrestigeChange` builds `prestige_change` as `before + rule line + clamp line = after`; the result equals
the stored `after` and the clamp line appears only when the rule left the bounds. `PlayerProjectionPrestige`
carries it as `changeExplanation` (additive, omitted when absent), and the status-strip prestige card renders it in
the shared disclosure with `strategic.prestige_change.*` labels. War score, tension and priorities keep their
exemptions: the first two still have no stored contribution history, and a priority's player-readable text is its
advice plus its existing trace, not a numeric tree.

`scripts/data/explanation-coverage.json` moves from 19/210 (9.04%) to 20/211 (9.47%). The recorded rule changes
the snapshot bytes of a month that applies prestige, so the Adriatic-war replay was re-recorded and approved as
`SERIALIZATION_ONLY`; no gameplay outcome, golden hash or other replay moved.

## Consequences

- `scripts/data/explanation-coverage.json` covers `report_treasury` and the fleet/construction trees
  added by the same batch; the strategic-area exemptions stay explicit and reasoned.
- No authoritative hash moves. The reports sidecar change is additive and backward compatible.
- #304 remains open only for the prestige-rule record and any future war-score/tension contribution
  ledger; #306 closes on the reconciliation tree with its remaining event-derived exemptions.

## Alternatives rejected

- **Build `prestige_change` from the stored before/delta/after.** It would show arithmetic, not why
  the value moved, and the applied declined-battle rule is not in the snapshot.
- **Sum report totals independently in the renderer.** Two calculations can drift; the report already
  carries the reconciliation the engine produced.
- **Duplicate economy/construction trees for the opening briefing.** It would create a second,
  drifting source for the same numbers.
