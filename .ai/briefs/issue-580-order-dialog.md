# Brief: one order dialog (issue #580)

T2. Branch `feat/issue-580-order-dialog`, draft PR into `dev`.

## Problem and evidence

- Ordering is split across `ConstructionWizard`, `BatchBuildDialog` (+ `batch-build/`) and `ForeignContractPanel`; the home preview returns names and dock fit only, no price or months.
- A design in study is in `nation.designStudies` until `approve()` writes it to `snapshot.designs`. `buildConstructionDesignCatalog` reads `snapshot.designs`, so an in-study design is invisible on the Build tab, and an order against it fails at `resolveOrderTargets` with `UNKNOWN_DESIGN`. `constructionOrderEligibility` has no study rule.

## Rejection codes the dialog explains

`OrderRejectionCode` (availability codes, `DESIGN_REVALIDATION_FAILED`, `DESIGN_REVALIDATION_UNAVAILABLE`, `DESIGN_NOT_YET_AVAILABLE`, `SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT`, `INSUFFICIENT_PROJECT_CAPACITY`, `FOREIGN_CONTRACT_PRIORITY_DEFERRED`, `DOCK_LIMIT_MISSING`), plus `NATIONAL_SUPPLY_UNAVAILABLE`, `CONSTRUCTION_PLAN_MISSING`, `CONSTRUCTION_BATCH_LIMIT_EXCEEDED`, `UNKNOWN_DESIGN`, new `DESIGN_STUDY_IN_PROGRESS`, and the foreign `capabilityFailureCode` values.

## Decisions

1. Engine: one exported quote (unit price, total price, build months, monthly instalment, delivery month) built from the same `resolveOrderCosts` + `orderBuildMonths` that `placeConstructionBatch` uses; `previewConstructionBatch` returns it and runs `constructionOrderEligibility`.
2. Engine: `resolveOrderTargets` returns `DESIGN_STUDY_IN_PROGRESS` for a design whose study is open.
3. Projection gains `studies` (open studies of the player, with months and cost remaining and the ready month). Field names follow `DesignStudyPreview`.
4. Foreign price and months per builder: the foreign preview computes terms for each capable candidate with the same `deriveForeignContractTerms`; no new rules.
5. Home Confirm sends `orderConstructionBatchCommand` (quantity 1 included); foreign Confirm sends `placeForeignConstructionCommand`. Backend submit/replace stay.
6. Result types stay TypeScript types (IPC results are not decoded; payload schemas are unchanged), so no new schema is needed.
7. A refused home preview stays a refusal with its reason and no quote. The dialog renders its blocked state from `refusalWording(reason)` alone (`order-view-model.ts`, status `blocked`, `summary: null`), so it needs no numbers. The bridge fixture (UK 1880, 3 x `des_gbr_inflexible`) is refused with `INSUFFICIENT_PROJECT_CAPACITY` by the national cap, not by treasury; the preview test now uses quantity 2 and a second test pins the quantity-3 refusal reason.

## Order of commits

1. engine quote and parity test, study rejection
2. projection `studies`
3. dialog and view-model merge, tests
4. remove wizard/batch/foreign components and dead tests, ledger rows, e2e
5. snap

## ACS

Issue #580 acceptance criteria.
