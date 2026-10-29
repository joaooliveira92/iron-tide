# ADR-0304: Displayed numbers carry an explanation tree; gunnery accuracy is the first slice

Applies to: combat, desktop, events

## Status

Superseded by: ADR-0357

Accepted (2026-10-25), amended 2026-10-26 by [#299](https://github.com/joaooliveira92/iron-tide/issues/299). Starts
[#265](https://github.com/joaooliveira92/iron-tide/issues/265) story 49 and the "Explainable" bar of `AGENTS.md`. Builds on
[ADR-0221](ADR-0221-structured-explanation-data.md). Does not complete the story: the coverage manifest and the per-area
tickets in `.ai/reports/story-49-explanation-inventory.md` track the rest.

## Decision

1. **Contract.** An explanation is the existing `ExplanationTree` of `@bluewave/events`: `formulaId`, `formulaVersion`,
   `inputs`, `intermediate`, `result`, `unit`, `operation`, `source`, `children`. It is built by `ExplanationBuilder`, which
   freezes it and rejects non-finite numbers. The domain emits the tree with canonical integers and stable ids; the
   presentation boundary turns it into text and numbers (ADR-0221), so the tree holds no prose and no locale.
2. **Operation and source.** A node may name what it does and where the rule comes from. `operation` is one of `identity`,
   `add`, `subtract`, `multiply`, `divide`, `round`, `clamp`. `source` is `{ kind, ref }` with `kind` one of `ruleset`,
   `content`, `manual`, `code`. Both are optional and additive: a tree written before this decision still decodes. The builder
   rejects an unknown operation and an empty source reference.
3. **Node identity and labels.** A node's `formulaId` is stable and dotted (`gunnery_accuracy`, `gunnery_accuracy.training`).
   A labelled node id is exactly `<formula>.<node>`. The renderer derives its message key as `<area>.<formula>.<node>` through
   one helper, so `gunnery_accuracy.crew` in the battle area reads `battle.gunnery_accuracy.crew`. A catalogue test fails when
   an id the engine can emit has no label, and the helper rejects an id that does not follow the convention.
4. **Order.** Children appear in the engine's canonical factor order, never in insertion or locale order. Every node of the
   accuracy tree is one multiplication of the base in basis points, with the floor recorded as an intermediate.
5. **Hidden information.** An explanation is attached only to the viewer's own side. The player-battle view carries
   `gunneryAccuracy` for the player's gunned ships and omits it for the enemy's, so it never reveals the enemy's crew, training
   or officer factors.
6. **First slice (gunnery accuracy).** `explainGunneryAccuracy` (`@bluewave/combat/gunnery`) calls the same `resolveAccuracy`
   that resolves fire, so the explanation cannot disagree with the result; only factors different from neutral become
   children. Every node names `operation: "multiply"` and the `gunnery_accuracy_v1` ruleset source. The player-battle view
   carries it as `PlayerBattleShipView.gunneryAccuracy` (additive, omitted when empty). The battle screen shows it in a native
   `<details>` disclosure listing the base, each modifier as a signed percentage change, and the final accuracy, with
   locale-aware percent formatting, and passes an automated axe audit.
7. **Coverage gate.** `scripts/data/explanation-coverage.json` lists each displayed view contract under coverage with its
   numeric and `ExplanationTree` fields, the covered formula per field, and a reason per exemption. The gate
   (`scripts/verify-explanation-coverage.mjs`, `pnpm check:explanation-coverage`) fails when a listed field has neither an
   explanation nor an exemption, when an entry is stale, or when the covered percentage falls below
   `minimumCoveredPercentBp`. Each area ticket adds its contract and removes exemptions as it explains numbers; the ratchet
   only moves up. The manifest replaces the one-time inventory as the machine-checked source of coverage.
8. **Battle numbers beyond accuracy.** The player-battle view also explains the player's torpedo solution
   (`torpedo_solution`), damage-control pumping and firefighting capacity (`damage_control`), and battle loss
   (`battle_loss`). Each tree is built from the same calculation the engine uses and is omitted for the enemy side. The battle
   screen renders them through one generic disclosure whose node labels are `<area>.<formula>.<node>` and whose numbers use the
   presentation formatters.

## Area slices (2026-10-26, #300–#303)

The batch branch `feat/story-49-area-explanations` adds four area slices through the same contract:

- **Economy and budget (#300).** `PlayerProjectionEconomy` carries `netExplanation` (`economy_net`), `monthEndExplanation`
  (`economy_month_end`), `runwayExplanation` (`economy_runway`, only while the treasury is shrinking) and
  `appropriationExplanation` (`economy_appropriation`). The month-end tree walks `EconomyOutlook.settlement` — the exact
  paid amounts the outlook books — so the result equals `monthEndTreasury`. The treasury status popovers show them in the
  shared disclosure.
- **Research (#303).** `ResearchScreenProjection` carries `budgetExplanation` (`research_budget`), `capExplanation`
  (`research_cap`) and `floorExplanation` (`research_floor`). The research status bar shows the paid budget (with the
  requested budget and the cap in the breakdown) and the explanation in its popover.
- **Construction and yards (#302).** `ConstructionProjectReadoutView` carries `scheduleExplanation`
  (`construction_schedule`): months left divided out of the work remaining and the monthly instalment. The project
  readout shows it under the schedule lines.
- **Fleet (#301).** `PlayerProjectionPresenceArea` carries `shortfallExplanation` (`fleet_presence`): required tonnage
  less present tonnage, with a recorded exemption line when a blockade suspends the requirement. The foreign-station
  table shows it in the shortfall cell.

`explanationLabelKey` moved to `apps/desktop/src/renderer/lib/explanation.ts`; the generic
`ExplanationDisclosure` (`apps/desktop/src/renderer/components/shared`) renders any area's tree with
`<area>.<formula>.<node>` labels and presentation-formatted values. The manifest ratchet moved from 2.07% to 6.40%
(13/203 fields).

## Continuation (2026-10-26, #301/#302/#306)

The second batch continues the same contract on the branch `feat/story-49-area-explanations-2`:

- **Construction (#302).** `ConstructionProjectReadout` now also carries `instalmentExplanation`
  (`construction_instalment`, the applied work split by production line) and `costExplanation`
  (`construction_cost`, the package total split by line). `monthlyAbsorbableDetail` exposes the per-line
  applied work so the instalment tree is built from the same draw the schedule uses.
- **Fleet (#301).** `FleetTrainingSubjectView` carries `maintenanceAdderExplanation` (`fleet_training_adder`)
  and `progressExplanation` (`fleet_training_progress`, months to proficiency); `FleetExerciseProjection`
  carries `experienceGainExplanation` (`fleet_exercise_gain`) whose source is the content rule.
  Crew quality, repair months and accumulated division experience/cohesion stay exempt because the view
  holds only the current value.
- **Reports (#306).** `MonthlyReportTreasury` carries `treasuryExplanation` (`report_treasury`) built from
  the month's `reconcileMonthLedger` result. The reports sidecar schema accepts the optional tree, so old
  reports decode unchanged.

## Continuation (2026-10-26, #304/#285)

The third batch closes the strategic area's honest gap:

- **Prestige (#304).** `PrestigeLastChange` records the applied rule, the unclamped target and the bounds;
  `PlayerProjectionPrestige.changeExplanation` carries `prestige_change` (`before + rule + clamp = after`) and the
  status-strip prestige card shows it in the shared disclosure. See the implementation section of ADR-0307.
- **Priorities (#285).** Every priority carries a player-readable `advice` sentence beside its engine `reason`; the
  briefing hover shows the advice first and the trace as the working. It is view/report text, not a numeric tree.
- **War score and tension (#304)** stay exempt until a contribution record exists (ADR-0307).

## Not delivered (tracked, not hidden)

- War score and tension need a stored contribution history before they can carry a tree; the opening briefing
  reuses the economy/construction/fleet trees. No tree is invented from a total.
- The ship designer has partial `ExplanationText` findings (ADR-0221) and is tracked by #168; the debug-only screens are not
  player-facing and are not in the manifest.

## Compatibility

Additive and unhashed: the new tree fields and the new view field are not part of the session hash or any snapshot, replay or
save. The replays and golden hashes verify unchanged.
