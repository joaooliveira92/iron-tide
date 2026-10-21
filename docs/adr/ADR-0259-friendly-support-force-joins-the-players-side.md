# ADR-0259: A friendly support force joins the player's side

## Status

Accepted (2026-10-21). Implements ticket
[#117](https://github.com/joaooliveira92/iron-tide/issues/117) (T-1 08) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R12 and R14 (support line). Builds on
[ADR-0255](ADR-0255-battle-offer-request-estimate-and-answer.md) and [ADR-0258](ADR-0258-enemy-declines-a-battle-with-the-player.md);
the presence chance, share of the cap and source are ruleset fields (`supportForce`), fixture-class in tests only
([ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md)).

## Decision

1. **Where.** `battle_generation`, immediately after `applyEnemyDeclines` (`applySupportForces`), so a battle the enemy
   withdrew never draws. It needs the `battleOffers` section and a `playerNationId` and never reads the interruption
   channel, so the draw cannot depend on how or when the player answers.
2. **Which battles.** Offered missions (`FLEET_BATTLE`, `CRUISER_BATTLE`) in which the player is attacker or defender.
3. **Eligibility.** The repository models no separate "operational access" or "authorization", so both are the existing
   data: an ally is a nation in an `allied` relation with the player that is neither party to the battle nor on the
   enemy's side of its war. Its ships pass the unchanged S-1 gathering (`gatherEligibleAssets`: not working up, reserve or
   mothballed, at or above the readiness floor, in the battle area, not already in a battle) and are not a committed asset
   of, or support in, another battle of the same pass. A nation without the relation contributes nothing.
4. **Composition.** Candidates in the existing allied ordering (`orderAlliedCandidates`), each taken when it still fits
   under `floor(committed player strength * min(shareOfCapBp, 5000) / 10000)`, otherwise skipped. The share is read in
   basis points of the player's committed strength and clamped to the existing 50% allied cap, so no ruleset value can
   exceed it. Only the `ALLIED_ONLY` behaviour exists: `ALLIED_AND_OWN_AI_DIVISIONS` is accepted by the schema but adds no
   own-AI divisions (G7 leaves that undecided).
5. **Draw.** Only when the composition is non-empty, exactly one draw: stream `battle-offer/support-force/<battle id>`,
   value `floor(next() * 10000)`, present when `draw < presenceChanceBp`. Recorded (stream, entity key, phase
   `battle_generation`, ruleset version, input hash over battle, manifest hash, ruleset fields, cap, candidates and
   composition, draw, outcome `PRESENT`/`ABSENT`, reason `BATTLE_SUPPORT_FORCE_PRESENT`/`_ABSENT`). The draw does not depend
   on the chance, so a ruleset change cannot reorder it. No candidates: no draw, no change.
6. **Effect.** A present force rides on the manifest: its ships on `temporaryAssets`, its nations on the player's side, and
   the manifest hash and battle seed are re-derived. Support ships are not `persistentAssets`, so the unchanged
   auto-resolution never promotes or damages them and generation never reserves them; declining or accepting leaves them
   unreserved and undamaged. Tactical support behaviour is T-2.
7. **Disclosure.** The offer's existing `supportForcePresent` flag is set and a new optional `supportNationIds` (sorted
   nations, never ship identities) is added; absent when there is no force, so an offer without support is byte-identical.
   The renderer line names the nations (`ui.offer.support.presentFrom`); #118 moves it into the compiled catalogue.

## Compatibility

Additive and dormant: the production pack authors no `battleOffers` section, so no month draws and no reference hash moves.
No persisted state changes (`CURRENT_COMPATIBILITY_VERSION` stays `4.0.0`). The offer wire shape gains one optional field,
covered by a round-trip and excess-key test.
