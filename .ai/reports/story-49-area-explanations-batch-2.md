# Story 49 batch 2: fleet, construction and report explanations

Branch `feat/story-49-area-explanations-2` (continues `feat/story-49-area-explanations`).
Finishes the fleet and construction areas' genuinely explainable numbers and decides the provenance of the
strategic and report areas. Story 49 remains open for #304's prestige-rule slice.

## Delivered

| Issue | Area         | New tree fields                                                                                                                     | Formulas                                                                 |
| ----- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| #301  | Fleet        | `FleetTrainingSubjectView.maintenanceAdderExplanation`, `.progressExplanation`; `FleetExerciseProjection.experienceGainExplanation` | `fleet_training_adder`, `fleet_training_progress`, `fleet_exercise_gain` |
| #302  | Construction | `ConstructionProjectReadout.instalmentExplanation`, `.costExplanation` (alongside `scheduleExplanation`)                            | `construction_instalment`, `construction_cost`, `construction_schedule`  |
| #306  | Reports      | `MonthlyReportTreasury.treasuryExplanation`                                                                                         | `report_treasury`                                                        |

Each tree is built by the same calculation that produces the displayed value:

- **Training adder.** `trainingAdderDetail` exposes the base subject adder and the nation multiplier;
  `trainingAdderBp` delegates to it, so the tree's result is the displayed `maintenanceAdderBp`. The nation
  adjustment line is omitted when the nation pays the neutral multiplier.
- **Training progress.** `explainTrainingProgress` subtracts the funded months from the proficiency threshold and
  never reports a negative; the fleet screen shows it under a funded subject's progress text.
- **Exercise gain.** The value is the content rule `fleet_management.divisionExperience.perExercise`; the tree is
  an identity node with a content source.
- **Construction instalment.** `monthlyAbsorbableDetail` exposes the applied work split by production line while
  `monthlyAbsorbable` returns the same amount as before. The instalment tree sums the six lines; the project
  readout shows "Work this month" under the cost-and-schedule lines.
- **Construction cost.** The total cost tree sums each package's `totalWork` by line; the project readout shows
  "Total cost" with the line split.
- **Report treasury.** `explainReportTreasury` is built from the month's `reconcileMonthLedger` result and sums
  opening, revenue, construction, preservation, maintenance, obligations, research and the signed other movement
  to the displayed closing balance. The month report shows it under the reconciliation line.

## Decisions (ADR-0307)

- **Prestige (#304).** The honest source is the applied prestige rule. The next slice records the applied rule on
  `PrestigeLastChange` (additive, versioned, parity-tested) and builds `prestige_change`. Until then the area stays
  exempt rather than reconstructing a rule from the recorded total.
- **War score and tension (#304).** Accumulated state with no stored contribution ledger; they stay exempt until a
  contribution record exists. A tree built from totals would invent provenance.
- **Priorities (#304).** The player-readable explanation is the existing `StrategicPriority.reason` trace; the
  numeric ranking keys are internal and not displayed.
- **Opening briefing (#304).** It re-exports economy, construction and fleet numbers; it reuses those trees rather
  than duplicating formulas.
- **Reports (#306).** Provenance is the month's ledger and reconciliation, not a new report-level aggregate.
  Construction and research progress entries are event projections, so the event is their provenance. The reports
  sidecar schema accepts the optional tree and old reports decode unchanged.

## Remaining exemptions

- Fleet: crew quality and repair months are accumulated state with no before/after in the view; division
  experience/cohesion and their penalties are accumulated state or ruleset constants.
- Construction: yard capacity is dock possession state; concurrency load is a per-project aggregate the view does
  not decompose; acceleration and commitment numbers are state or ruleset constants.
- Strategic: tension, war score and the recorded prestige change stay exempt per ADR-0307.
- Reports: ledger rows are the source lines, progress entries are event projections, and metadata is not derived.

## Rendering

The shared `ExplanationDisclosure` renders all three areas. New labels are in
`apps/desktop/src/renderer/lib/en-us-messages.ts` with `<area>.<formula>.<node>` keys. The fleet training and
exercise disclosures render outside the checkbox label so expanding them does not toggle funding.

## Evidence

- Domain tests: `campaign/test/constructionDraw.test.ts`, `campaign/test/specialTraining.test.ts`;
  `campaign-engine/test/construction.test.ts`, `campaign-engine/test/fleet-explanations.test.ts`,
  `campaign-engine/test/report-explanations.test.ts`.
- Renderer/main tests: `ProjectReadout.test.tsx`, `FleetTrainingView.test.tsx`, `FleetExerciseView.test.tsx`,
  `MonthReportCard.test.tsx`, `monthlyReports.test.ts`, `commitMonth/reportEntry.test.ts`.
- Focused runs: `@bluewave/campaign` 1109 tests, `@bluewave/campaign-engine` 171 tests, desktop fleet/construction/
  overview plus report sidecar 250 tests.
- `pnpm preflight` 49/49.
- `pnpm snap` evidence (git-ignored under `apps/desktop/.dev-data/story49-batch2/`):
  `overview/` shows `Treasury closed at 1,039`; `construction-explanation/` shows "Work this month 2" split as
  "Slipway work 2" and "Total cost 100" split as "Hull and launch 76", "Fit-out 19", "Trials and acceptance 5";
  `fleet-explanation/` shows "Maintenance adder 30%" expanded to "Base subject adder 30%" and "Exercise gain 5
  experience".

## Coverage

`scripts/data/explanation-coverage.json` moved from 13/203 (6.40%) to 19/210 (9.04%); the ratchet is now 904 bp.

## Follow-ups

- Record the applied prestige rule and add `prestige_change` (tracked by #304).
- If war score or tension needs a tree, add a contribution record first; do not derive it from totals.
- Yard capacity/concurrency can gain a tree when the per-project reservation breakdown is exposed to the view.
