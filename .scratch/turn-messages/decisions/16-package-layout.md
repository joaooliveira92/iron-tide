# D-16: `@bluewave/messages` package and repository layout

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

What is the concrete package and file layout?

## Answer

```
packages/messages/src/{index,schema,interruption,project,policy,aggregate,provenance,errors,version}.ts  (+ test/)
packages/phase-engine/src/interruption.ts            # seam: raises requests, consumes inputs, sets MonthResult.suspended
apps/desktop/src/shared/turn-contract.ts             # DTOs + schemas
apps/desktop/src/main/pendingTurn.ts | turnSummaries.ts
apps/desktop/src/main/commands/{resolveTurn,answerDecision,submitBattleResult,readTurnSummaries,abandonPendingTurn}.ts
apps/desktop/src/renderer/.../{TurnSummaryPanel,DecisionDialog,BattleRequestDialog,TurnHistory}.*
content/production/<scenario>/ui/*.yaml              # en-US catalogue
```

Graph: `phase-engine → messages → {events, campaign, contracts, deterministic,
content-schema}` (acyclic; `messages` never depends on `phase-engine` or desktop).

(Locked round 3.)

## Consequence

Consumed by D-06, D-13. Exact module boundary names are spec-level; validated by
R-21.
