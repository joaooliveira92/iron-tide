# ADR-0256: Declining a battle offer: terminal record, released ships, victory-point cost

Applies to: desktop, messages, phase-engine

## Status

Accepted (2026-10-21). Implements ticket
[#113](https://github.com/joaooliveira92/iron-tide/issues/113) (T-1 04) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R8, R13 (class refusal), R14, R15. Builds on
[ADR-0255](ADR-0255-battle-offer-request-estimate-and-answer.md) and
[ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md) (the decline values, fixture-class in tests only).

## Decision

1. **A decline is a terminal declined record.** `wars.declinedBattles` (additive, optional, absent until the first
   decline) holds one `DeclinedBattleRecord` per declined battle: battle, war, decliner, area, month, mission, the hash of
   the recorded response input, the victory-point cost and the opponent credit. The battle instance moves to the new
   terminal phase `declined`; it never reaches `resolved`, is never fought and is skipped by every later month, so it is
   scored once even though the record persists. Records keep application order, which is the canonical offer order.
2. **Ships are released, untouched.** The reservation (`inBattleId`) is cleared on every ship in the battle manifest's
   committed assets, by asset id (the generation phase stamps one reservation id on all ships of a month, so clearing by
   battle id would be wrong). No damage, loss, contribution points or ordinary war score.
3. **Victory points go through one war-score seam.** `applyWarScoreDelta` shares the clamp (-100..100) and the surrender
   check with `applyBattleResult`, which now calls the same two helpers. The decliner's side falls by the mission's
   `pointsByMission` entry; the opponent is credited per the ruleset shape (`NONE`, `MIRROR`, or `FRACTION_BP` with the
   section's rounding). The change applies at the response, so a later offer in the same month sees it.
4. **Refusals leave the offer pending and the ordinal unconsumed.** An OPERATIONALLY_UNAVOIDABLE mission is refused with the
   existing `BATTLE_DECLINE_NOT_ALLOWED` (via `assertDeclineAllowed`). A mission the ruleset does not price, or a
   `distanceModifier` other than `NONE` (its measure is an opaque id no decision defines), is refused as
   `OfferDeclineUnpriced`: a decline is never free and no distance semantics are invented. A duplicate response is
   `OfferResponseDuplicate`; a battle that already has a record is never re-scored.
5. **Event and message.** `BattleDeclined` (nation, battle, mission, area, cost, credit, reason
   `BATTLE_DECLINED_WITH_CONSEQUENCES`) is the audit record; it projects to the `messages.battle.declined.*` turn message
   carrying the cost. The strings live in the renderer's en-US catalogue, which `resolveMessage` now falls back to, so the
   compiled content catalogue and its hash do not move while the feature is dormant.
6. **Desktop.** `submitOfferResponse` accepts `decline`. The pending-turn sidecar's outstanding identity gains the optional
   offer `acceptanceClass`, so the boundary refuses an unavoidable decline with `BATTLE_DECLINE_NOT_ALLOWED` before
   recording it (a recorded refused input would otherwise block the ordinal). The dialog adds a decline button
   (`aria-disabled` with a reason when refused, so it stays keyboard-reachable), the plain cost statement from
   `declineStatementKeys`, and the shell reports the decline with its cost.

## Compatibility assessment

Persisted state changes additively: `wars.declinedBattles` (strict `StorableDeclinedBattleSchema`, optional) and the
`declined` battle phase. A save that never declines is byte-identical to before and decodes unchanged; a pre-change save
loads with the collection absent. Neither addition has a default or alters an existing outcome, and nothing reads the new
state unless a decline happened, so `CURRENT_COMPATIBILITY_VERSION` stays `4.0.0` (no bump, no migration). No golden,
content lock or replay corpus moves; the production pack authors no `battleOffers` section. The counter, threshold event,
prestige effect, enemy decline and support force remain later tickets (#114 to #117).
