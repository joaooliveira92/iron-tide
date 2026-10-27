# ADR-0258: The enemy declines a battle with the player

Applies to: phase-engine

## Status

Accepted (2026-10-21). Implements ticket
[#116](https://github.com/joaooliveira92/iron-tide/issues/116) (T-1 07) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R11 and R14 (message). Builds on
[ADR-0255](ADR-0255-battle-offer-request-estimate-and-answer.md); the comparison, threshold, probability and enemy cost
are ruleset fields (`enemyDecline`), fixture-class in tests only ([ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md)).

## Decision

1. **Where.** `battle_generation`, immediately after `generateBattles` and before any instance, reservation or manifest
   is written (`applyEnemyDeclines`). It needs the `battleOffers` section and a `playerNationId`, and nothing else: it
   never reads the interruption channel, so the decision cannot depend on how or when the player answers an offer.
2. **Which battles.** A generated battle whose mission is an offered one (`FLEET_BATTLE`, `CRUISER_BATTLE`) and in which
   the player nation is attacker or defender. AI-versus-AI battles and every other mission are untouched. An
   `OPERATIONALLY_UNAVOIDABLE` battle cannot be declined by the enemy either, as for the player (ADR-0256).
3. **Predicate.** The force balance is the strength of the enemy's committed ships against the player's committed ships
   in the generated manifest (the same "true strength" the offer estimates, `resolveShipStrength`). It holds when
   `enemy * 10000 {<, <=} thresholdBp * player`, compared exactly in bigint with no division or rounding; a zero player
   force never holds. Because optional assets are chosen by the existing weighted stream, the balance is the balance of
   the battle that would be fought, not of every ship in the area.
4. **Draw.** Only when the predicate holds, exactly one draw: stream `battle-offer/enemy-decline/<prospective battle id>`
   (the id carries war, area, mission and month), value `floor(next() * 10000)`, compared as `draw < probabilityBp`. It is
   recorded in the random ledger (stream, entity key, phase `battle_generation`, ruleset version, input hash over battle,
   manifest hash and the ruleset fields, draw, outcome `DECLINED`/`PROCEEDS`, reason `BATTLE_ENEMY_DECLINED`/
   `BATTLE_ENEMY_PROCEEDS`). The draw does not depend on the probability, so changing the ruleset cannot reorder it. When
   the predicate does not hold nothing is drawn or recorded.
5. **Effect.** A declined battle is removed from the generated set: no `BattleInstance`, manifest, reservation or offer.
   The enemy pays only `enemyCostPoints` through the one war-score seam (absent = none, so no war-score change). One
   `EnemyDeclinedBattle` event (player, enemy, battle, mission, area, enemy cost) is appended; it never carries the draw or
   the enemy force. It projects to `messages.battle.enemyDeclined.*` (BATTLE, HIGH, phase `battle_generation`). The
   opportunity is regenerated next month with a fresh month-keyed battle id and a fresh draw.
6. **Proceeding.** On the complementary draw the battle is kept untouched, so the offer and the accepted month equal those
   of a month whose predicate did not hold; only the one recorded draw differs.

## Compatibility

Additive and dormant: the production pack authors no `battleOffers` section, so no month draws, no event kind appears and no
reference hash moves. No persisted state changes (`CURRENT_COMPATIBILITY_VERSION` stays `4.0.0`); the strings live in the
renderer catalogue as for the decline messages, and ticket #118 moves them into the compiled catalogue.
