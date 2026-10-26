# Story 49 inventory: displayed numbers and their explanation trees

Spec [#265](https://github.com/joaooliveira92/iron-tide/issues/265) story 49 and the audit step of
[#223](https://github.com/joaooliveira92/iron-tide/issues/223). Taken 2026-10-25 on branch `feat/fm-war-replay`. ADR-0304 defines the
contract and the first slice. **Story 49 is not complete.**

## Method

A displayed number reaches a screen through a typed view or contract. The count below is the number of `number` or `SafeInt` fields in
each view contract that a renderer can show, from `packages/campaign-engine/src/*.ts` and `apps/desktop/src/shared/*contract*.ts`. It
over-counts ids and counters that are not shown and under-counts numbers derived in the renderer, so it sizes the work and is not a
coverage percentage. A field counts as explained only when an `ExplanationTree` or `ExplanationText` backs it end to end.

## Inventory by area

| Area                                    | Contracts                                                                                     | Numeric fields |                                                               Explained today | Child ticket         |
| --------------------------------------- | --------------------------------------------------------------------------------------------- | -------------: | ----------------------------------------------------------------------------: | -------------------- |
| Economy and budget                      | `budget-contract`, `ledger-reconciliation`, `economyOutlook`                                  |             43 | 0 (revenue, maintenance and obligations are shown as a breakdown, not a tree) | economy numbers      |
| Fleet, readiness, training and exercise | `fleet-contract`, `division-screen`, `fleet.ts`                                               |             28 |                                0 (adders and crew quality are stated in text) | fleet numbers        |
| Construction and yards                  | `construction-contract`, `construction.ts`                                                    |             28 |                                                                             0 | construction numbers |
| Research                                | `research.ts`, `research-contract`                                                            |             18 |                                                                             0 | research numbers     |
| Diplomacy, war, prestige, priorities    | `diplomacy.ts`, `projection.ts`, `priorities.ts`, `opening-briefing.ts`, `diplomacy-contract` |             54 |                                                                             0 | strategic numbers    |
| Battle                                  | `playerSession` view, `battle-history.ts`                                                     |              3 |                                                1 (gunnery accuracy, ADR-0304) | battle numbers       |
| Turn reports and messages               | `reports-contract`, `turn-message-contract`                                                   |             30 |                                                                             0 | report numbers       |
| Ship designer                           | `design-contract`, `design.ts`                                                                |             16 |                          partial (findings carry `ExplanationText`, ADR-0221) | covered by #168      |
| Debug and simulation                    | `simulation.ts`, `debug.ts`                                                                   |             45 |                                 not applicable (debug only, ADR-0226 pending) | none                 |

About 200 fields (204 by this count) reach production screens outside the designer and debug rows, and one has a full tree.

## Next steps, in dependency order

1. **Contract hardening.** Add `operation` and a source reference to `ExplanationTree`, fix the label-key convention, and add a gate that
   fails when a numeric field of a listed contract has no explanation or recorded exemption. Every area ticket depends on it.
2. One ticket per area in the table, each delivering a tree for its most consequential numbers first and stating its remaining fields.
3. The coverage gate then reports a real percentage and replaces this one-time audit.
