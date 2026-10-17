# R-25: S-4 / T-1 seam ground-truth

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

What exactly must the generic decision and battle ports carry so that S-4 and T-1
can plug in without reopening this charter? Ground the seam contract against the
current repository and the sprint plan.

Specifically:

- `.ai/SPRINT-PLAN.md` entries for **S-4 "Events and crises"** and **T-1 "Battle
  offer flow"** — their stated manual references, dependencies, and acceptance.
- Existing decision/crisis or battle-offer types anywhere (confirm none exist) and
  the existing `StrategicPriority` shape (`campaign-engine/src/priorities.ts`) as
  the nearest analogue.
- `packages/combat` battle generation/auto-resolution types and the unemitted
  `BattleInitiated`/`BattleResolved` event bodies — what a `BattleRequest`/
  `BattleResult` port must carry to bridge them.
- Whether S-4/T-1 must be blocked on `M2` only, or also `M3`/`M4` for their stated
  scope — confirm the map's cross-effort dependency table.

## Answer

**Resolved — no decision/crisis/battle-offer types exist; the ports are
greenfield.** Nearest analogue is the pure `StrategicPriority` projection
(`priorities.ts:50-59`) — but it carries no interruption identity, ordinal, answer,
or effect surface.

- **S-4** (`SPRINT-PLAN.md:116`, "Research first", depends S-2/S-3; manual gap
  `:44`): catalogue of hawk/dove answers moving tension/prestige/budget; government
  types/traits gate eligibility.
- **T-1** (`SPRINT-PLAN.md:123`, depends S-1; manual gap `:60`): force estimate,
  accept/decline with VP + prestige cost, support force, mission types; T-2 follows.
- **Combat grounding:** `BattleMissionOpportunity` already models
  `ACCEPTED`/`DECLINED`/`EXPIRED` (`generation/opportunity.ts:11-38`);
  `acceptanceClass` (`OPTIONAL|POLITICALLY_EXPECTED|OPERATIONALLY_UNAVOIDABLE`) and
  `resolveDecisionBoundary` returning `null` to hold pending (`acceptance.ts:7-51`);
  `BattleManifest` (`manifest.ts:16-65`); auto-resolution returns
  `winnerId/loserId|null` (`battleResolution/resolve.ts:76-120`). Campaign
  `BattleInstance`/`BattleResult` (`campaign/src/state.ts:167-206`). Decision
  effects resolve onto the diplomacy appliers (`diplomacy.ts:33-188`) and
  `NationBudgetChanged` (`envelope.ts:9-16`).
- **Battle-port flag:** campaign `BattleResult` permits a null (tie) outcome
  (`state.ts:198-199`; ADR-0026 §7) but the frozen `BattleResolved` body requires
  non-empty winner/loser (`validation.ts:105-110`). The port's `BattleResult` must
  therefore carry nullable winners; the event stays **unemitted**. Not a locked-
  decision contradiction.

**Blocking recommendation:** block S-4 and T-1 on **M2** only for their stated
engine-scope acceptance (a deterministic test driving a `DecisionAnswer`/
`BattleResult` through the seam satisfies the sprint gate, `SPRINT-PLAN.md:11-13`);
add **M3** (application commands) and **M4** (renderer) edges only for player-facing
full-flow tickets. Independent prerequisites stay: S-4 → S-2/S-3 + research;
T-1 → S-1.
