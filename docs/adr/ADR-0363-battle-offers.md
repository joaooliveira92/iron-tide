# ADR-0363: Battle offers — estimate, decline, enemy decline, and support force

Consolidates: ADR-0253, ADR-0254, ADR-0255, ADR-0256, ADR-0257, ADR-0258, ADR-0259, ADR-0262, ADR-0263, ADR-0264, ADR-0265

Applies to: campaign, content, content-compiler, content-schema, cross-process-test, desktop, events, messages, persistence, phase-engine

Rule: Battle offers are raised for eligible missions when the ruleset section is authored; the player may decline at a victory-point cost, repeated declines trigger prestige loss through the S-2 seam, the enemy may decline when outmatched, and a support force may join under defined conditions.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0253
Supersedes: ADR-0254
Supersedes: ADR-0255
Supersedes: ADR-0256
Supersedes: ADR-0257
Supersedes: ADR-0258
Supersedes: ADR-0259
Supersedes: ADR-0262
Supersedes: ADR-0263
Supersedes: ADR-0264
Supersedes: ADR-0265
Consistent with: ADR-0356

## Context

The battle-offer mechanics (manual pp.49-53) need a ruleset section for values, a player-nation month input, an offer request with estimate, the ability to decline with victory-point cost, a declined-battle tally with threshold events, an enemy-decline rule, a support-force rule, prestige consequences for repeated declines, and the go-live authoring of the production section. No sourced values existed initially (`docs/research/t-1-battle-offer-values.md`, decisions 0028-0034). The owner delegated every value as a labelled `balance_adjustment` target (ADR-0254, same pattern as ADR-0239 and ADR-0266). All values are `BALANCE_TARGET` with the "simulation matches RTW3" constraint waived.

The entire T-1 battle-offer feature is dormant when the production pack authors no `battleOffers` section. The section is authored on the `core` ruleset in `content/production/1880/rulesets.yaml` by ticket #118 (ADR-0263) with every ADR-0254 value.

## Rules

### 1. Ruleset section and player-nation input

1.1. An optional ruleset section `battleOffers`, decoded strictly by `decodeBattleOfferRules` (`@bluewave/content-schema`): `sectionVersion` 1, estimate model (EXACT, BANDED, PERTURBED), decline victory points by mission type with a distance modifier and opponent credit, decline counter (threshold, scope, reset), enemy decline, support force, an optional declined-battle prestige sub-rule, and `provenance`. All-or-nothing; excess keys, non-integers and out-of-range basis points fail compile with `BATTLE_OFFER_RULES_INVALID` naming the field; two carriers with `BATTLE_OFFER_RULES_AMBIGUOUS`. Absent = dormant; no default exists. Mission-type keys are opaque ids checked against the combat vocabulary by the consumer.

1.2. `MonthExecutorEngineOptions.playerNationId` is the single explicit player-nation month input. It is validated against the snapshot before any phase runs; an unknown id fails the month with `PLAYER_NATION_UNKNOWN`.

1.3. `OfferResponseInput { interruptionId, battleId, response: accept | decline | delegate }` is a new interruption kind `offer`, beside the untouched `BattleResultInput`. `consumeOfferResponse` hash-validates and consumes it by ordinal; it reports awaiting/invalid rather than suspending.

### 2. Balance targets (T-1 values)

2.1. **Every value below is a Bluewave balance decision** (`kind: balance_adjustment`, `sourceStatus: BALANCE_TARGET`). Each is recorded with rationale, lives as a named centralized `battleOffers` ruleset constant, and is never presented as a sourced fact.

| # | Item | Decision | Rationale |
| --- | --- | --- | --- |
| G1 | Estimate model | `PERTURBED`; symmetric error bound 2000 bp of true strength; drawn from a domain-separated stream keyed by battle and side; rounding half-up; strength only | About one fifth of error makes declining a real judgement without hiding a lopsided fight. |
| G2 | Decline VP cost | Fleet battle 5, cruiser battle 2 war-score points; no distance modifier | Small against the +/-100 war-score scale. Cruiser actions smaller than fleet. |
| G3 | Opponent credit | `NONE` | The manual says only the decliner pays; crediting the enemy would double the cost. |
| G4 | "Several" threshold | Threshold 3 declines, scope `WAR`, reset `ON_WAR_END` | Smallest count that reads as "several". |
| G5 | Prestige | Proportional 300 bp of current prestige, S-2 loss arithmetic (`max(1, ceil(prestige * bp / 10000))`); applied on each decline at or after the threshold (each further decline) | 3% equals unpaid-funds loss, below 5% battle-lost loss. |
| G6 | Enemy decline | Predicate: enemy strength < 5000 bp of player strength; probability 5000 bp when predicate holds; no enemy cost | Enemy declines when outmatched two to one or worse, then half the time. |
| G7 | Support force | Presence chance 2000 bp; composition uses existing 5000 bp share cap (`ALLIED_MAX_STRENGTH_BP`); source `ALLIED_ONLY` | "Sometimes" read as one battle in five; existing cap reused. |

### 3. Offer request, estimate, and answer

3.1. **The offer is a third interruption request**, `OfferRequest` (`kind: "offer"`), beside `DecisionRequest` and `BattleRequest`. It carries exactly: mission type and acceptance class, area, the two sides, the player's side, the player's own force (id, name, class), the estimate (`model`, integer `strength`), `supportForcePresent` (always `false` until the support-force ticket), and the decline-statement message keys. The strict wire schema rejects any other key.

3.2. **Raised in `battle_resolution`** only when the month has an interruption channel, a `playerNationId` and a `battleOffers` section, and the pending battle has a manifest whose mission is `FLEET_BATTLE` or `CRUISER_BATTLE` and whose attacker or defender is the player. Offers arrive in the order battles are processed (generation order: war, area, mission priority, id). With the section absent, the legacy battle request is raised exactly as before.

3.3. **Estimate.** `estimateEnemyStrength` is a pure integer function: EXACT is the true strength, BANDED rounds it to the band width, PERTURBED scales it by `10000 + perturbationBp` basis points, all through a bigint intermediate with stated rounding and never below zero. True strength is the summed firepower of enemy ships in the manifest's committed assets. A perturbation is `draw - errorBoundBp` from the stream `battle-offer/estimate/<battle>/<enemy side>` and is recorded in the random ledger (stream, entity key, phase, ruleset version, input hash, draw, outcome, reason `BATTLE_OFFER_ESTIMATE_PERTURBED`). Composition is not shown.

3.4. **Accept and delegate** resume through unchanged auto-resolution, so war score, consequences and the recorded result equal the non-offered run's. The answer is recorded as `BattleOfferAnswered` (nation, battle, mission, `accept` or `delegate`, `AUTO_RESOLVE`).

3.5. **Typed refusals.** `consumeOfferResponse` reports `OfferResponseDuplicate`, `OfferResponseOutOfOrder`, `OfferResponseWrongKind`, `OfferResponseStale`, `OfferResponseTampered` and `OfferResponseWrongBattle`; a decline is refused as `OfferDeclineUnavailable` until the decline ticket. The month suspends with `invalid-input` and the same offer, and `SuspendedTurn.refusalTag` (optional, additive) names the tag.

3.6. **Desktop and renderer.** The command is strict (excess keys rejected). `OfferDialog` is a Base UI alert dialog: labelled, described, modal, focus moves in and Escape does not dismiss it. All strings are stable `ui.offer.*` and `messages.offer.request.*` keys in the renderer's en-US catalogue (`lib/strings.ts`), not the compiled content catalogue, so a dormant feature moves no content and no replay header.

### 4. Decline: record, release, victory-point cost

4.1. **A decline is a terminal declined record.** `wars.declinedBattles` (additive, optional, absent until the first decline) holds one `DeclinedBattleRecord` per declined battle: battle, war, decliner, area, month, mission, the hash of the recorded response input, the victory-point cost and the opponent credit. The battle instance moves to the terminal phase `declined`; it never reaches `resolved` and is skipped by every later month.

4.2. **Ships are released, untouched.** The reservation (`inBattleId`) is cleared on every ship in the battle manifest's committed assets, by asset id. No damage, loss, contribution points or ordinary war score.

4.3. **Victory points go through one war-score seam.** `applyWarScoreDelta` shares the clamp (-100..100) and the surrender check with `applyBattleResult`. The decliner's side falls by the mission's `pointsByMission` entry; the opponent is credited per the ruleset shape. The change applies at the response, so a later offer in the same month sees it.

4.4. **Refusals leave the offer pending and the ordinal unconsumed.** An `OPERATIONALLY_UNAVOIDABLE` mission is refused with `BATTLE_DECLINE_NOT_ALLOWED` (via `assertDeclineAllowed`). A mission the ruleset does not price is refused as `OfferDeclineUnpriced`. A duplicate response is `OfferResponseDuplicate`; a battle with a record is never re-scored.

4.5. **Event and message.** `BattleDeclined` (nation, battle, mission, area, cost, credit, reason `BATTLE_DECLINED_WITH_CONSEQUENCES`) is the audit record; it carries a required `declineCount` (positive safe integer): the player's declined-battle tally in the ruleset's counter scope after this decline. It projects to the `messages.battle.declined.*` turn message carrying the cost.

4.6. **Desktop.** `submitOfferResponse` accepts `decline`. The pending-turn sidecar's outstanding identity gains the optional offer `acceptanceClass`, so the boundary refuses an unavoidable decline with `BATTLE_DECLINE_NOT_ALLOWED` before recording it. The dialog adds a decline button (`aria-disabled` with a reason when refused) and the shell reports the decline with its cost.

### 5. Declined-battle tally and threshold event

5.1. **The tally is `wars.declineCounters`**, additive and absent until the first decline. One `DeclineCounterEntry` per scope key holds `key`, the last decliner `nationId`, `lastWarId`, the current `count` and a `decayAnchorMonth`. The key carries the scope (`WAR|war|nation`, `NATION|nation`, `CAMPAIGN`). Only `applyDecline` writes it, and it is called only for the player nation, so AI and non-player declines never count.

5.2. **Monotonic means one per recorded decline.** The count rises by exactly one per decline. It falls only by the ruleset's declared reset: `NONE`, `ON_WAR_END` (cleared at the next decline once the last war is `ENDED`), or `DECAY` (`countRemoved` per whole `perMonths` since the anchor, floored at zero). Resets are applied lazily at the next decline.

5.3. **The threshold event is `DeclineThresholdReached`** (nation, battle, count, threshold, scope, ruleset version), appended right after the decline's `BattleDeclined`. It fires when the count reaches the threshold from below. When the ruleset's prestige sub-rule declares `repeat: EACH_FURTHER_DECLINE` it also fires on each decline at or above the threshold.

5.4. **Message.** The event projects to `messages.battle.declineThreshold.*` (BATTLE, HIGH). The strings live in the renderer's en-US catalogue.

### 6. Repeated declines prestige cost

6.1. **Trigger.** In `applyDecline`, right after `DeclineThresholdReached` is appended.

6.2. **Seam only.** It calls `applyPrestigeChange(ctx, decliner, "DECLINED_BATTLE", rule)` with the ruleset's `declinedBattlePrestige.rule` (brand-checked into `SafeInt`). No prestige arithmetic, bound or event construction lives in T-1.

6.3. **Player only.** The cost applies only when the decliner is `ctx.playerNationId`.

6.4. **Dormant.** Without the `declinedBattlePrestige` sub-rule nothing is called.

### 7. Enemy decline

7.1. **Where.** `battle_generation`, immediately after `generateBattles` and before any instance, reservation or manifest is written (`applyEnemyDeclines`). It needs the `battleOffers` section and a `playerNationId`, and never reads the interruption channel.

7.2. **Which battles.** A generated battle whose mission is `FLEET_BATTLE` or `CRUISER_BATTLE` and in which the player nation is attacker or defender. OPERATIONALLY_UNAVOIDABLE cannot be declined by the enemy. AI-vs-AI battles are untouched.

7.3. **Predicate.** The force balance is enemy strength against player strength in the generated manifest (true strength). It holds when `enemy * 10000 {<, <=} thresholdBp * player`, compared in bigint; a zero player force never holds.

7.4. **Draw.** Only when the predicate holds, exactly one draw: stream `battle-offer/enemy-decline/<prospective battle id>`, value `floor(next() * 10000)`, compared as `draw < probabilityBp`. Recorded in the random ledger (stream, entity key, phase `battle_generation`, ruleset version, input hash over battle, manifest hash and ruleset fields, draw, outcome `DECLINED`/`PROCEEDS`, reason `BATTLE_ENEMY_DECLINED`/`_PROCEEDS`).

7.5. **Effect.** A declined battle is removed from the generated set: no `BattleInstance`, manifest, reservation or offer. The enemy pays `enemyCostPoints` through the war-score seam (absent = none). One `EnemyDeclinedBattle` event (player, enemy, battle, mission, area, enemy cost) is appended. The opportunity is regenerated next month.

### 8. Friendly support force

8.1. **Where.** `battle_generation`, immediately after `applyEnemyDeclines` (`applySupportForces`). It needs the `battleOffers` section and a `playerNationId`; never reads the interruption channel.

8.2. **Which battles.** Offered missions (`FLEET_BATTLE`, `CRUISER_BATTLE`) in which the player is attacker or defender.

8.3. **Eligibility.** An ally is a nation in an `allied` relation with the player that is neither party to the battle nor on the enemy's side of its war. Its ships pass the S-1 gathering (`gatherEligibleAssets`) and are not a committed asset of, or support in, another battle of the same pass.

8.4. **Composition.** Candidates in the existing allied ordering (`orderAlliedCandidates`), each taken when it still fits under `floor(committed player strength * min(shareOfCapBp, 5000) / 10000)`, otherwise skipped. Only `ALLIED_ONLY` behaviour exists.

8.5. **Draw.** Only when the composition is non-empty, exactly one draw: stream `battle-offer/support-force/<battle id>`, value `floor(next() * 10000)`, present when `draw < presenceChanceBp`. No candidates: no draw.

8.6. **Effect.** A present force rides on the manifest: its ships on `temporaryAssets`, its nations on the player's side, and the manifest hash and battle seed are re-derived. Declining or accepting leaves them unreserved and undamaged.

8.7. **Disclosure.** The offer's `supportForcePresent` flag is set and `supportNationIds` (sorted nations) is added; absent when there is no force. The renderer line names the nations.

### 9. Production go-live

9.1. **The section is authored in `content/production/1880/rulesets.yaml`**, on the `core` ruleset, with every ADR-0254 value (G1 to G7 and the G5 sub-rule) and its own `BALANCE_TARGET` / `balance_adjustment` provenance citing ADR-0254. No value is defaulted in code.

9.2. `declineVictoryPoints.rounding` is authored `HALF_UP` (the one rounding ADR-0254 states for G1), which is inert when opponent credit is `NONE`.

9.3. Player-facing strings move into the compiled catalogue (`ui/en-US.yaml`): the offer dialog, decline statements, `messages.battle.declined`, `declineThreshold` and `enemyDeclined`, `ui.offer.support.presentFrom`, and `messages.prestige.changed`. The renderer-local copies are removed.

9.4. Removing the section returns the pack to dormant behaviour: no offer is raised and the pre-existing battle request runs unchanged.

### Compatibility

- `CURRENT_COMPATIBILITY_VERSION` stays `4.0.0` through all T-1 changes. Additions are optional or wider union members: `wars.declinedBattles`, `wars.declineCounters`, the `FIXED_LOSS` prestige rule kind, the optional `DECLINED_BATTLE` key of the stored prestige rule set.
- Older saves load unchanged: every addition is optional, nothing is defaulted or inferred. A save that never declines is byte-identical to before.
- New-state saves are refused rather than silently misread by a reader without the fields: unknown rule kinds fail the stored union, and dropped keys change the semantic hash.
- The content hash moves when the `battleOffers` section is authored (#118); the content lock is refreshed. `golden/hashes.json` does not move (its proof compiles a synthetic inline fixture). Production replays move only in `contentHash`; checkpoint hashes are unchanged.
- Saves gain battle-offer state only when a decline happens (additive optional fields), so no migration is needed.

### Consequences

- A bump would be the wrong remedy for these additive optional fields: it would refuse every earlier 4.0.0 save, contradicting the additive policy.
- Tuning any value is a ruleset version change with a content-lock refresh (ADR-0254).
- Offers per month beyond one accepted battle per area, coastal raid ownership, and decline-cost display remain open observations.
- If a higher-trust source for any value appears, it replaces the balance value through a ruleset version change, and this ADR is amended.