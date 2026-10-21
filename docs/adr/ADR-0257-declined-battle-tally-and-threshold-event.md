# ADR-0257: Declined-battle tally and the repeated-decline threshold event

## Status

Accepted (2026-10-21). Implements ticket
[#114](https://github.com/joaooliveira92/iron-tide/issues/114) (T-1 05) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R9 and R14 (message). Builds on
[ADR-0256](ADR-0256-battle-offer-decline-record-release-and-victory-point-cost.md); the scope, threshold and reset values
are ruleset fields (`declineCounter`), fixture-class in tests only ([ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md)).

## Decision

1. **The tally is `wars.declineCounters`**, additive and absent until the first decline. One `DeclineCounterEntry` per
   scope key holds `key`, the last decliner `nationId`, `lastWarId`, the current `count` and a `decayAnchorMonth`. The key
   carries the scope (`WAR|war|nation`, `NATION|nation`, `CAMPAIGN`), so a tally of one scope is never reused by another.
   Only `applyDecline` writes it, and it is called only for the player nation, so AI and non-player declines never count; a
   duplicate response returns before the tally, so a battle counts once.
2. **Monotonic means one per recorded decline.** The count rises by exactly one per decline. It falls only by the ruleset's
   declared reset: `NONE`, `ON_WAR_END` (cleared at the next decline once the last war is `ENDED`), or `DECAY` (`countRemoved`
   per whole `perMonths` since the anchor, floored at zero). Resets and decay are applied lazily at the next decline, so a
   campaign that never declines never writes the collection. The arithmetic is integer-only (`tallyDecline`, pure).
3. **The threshold event is `DeclineThresholdReached`** (nation, battle, count, threshold, scope, ruleset version), appended
   right after the decline's `BattleDeclined`. It fires when the count reaches the threshold from below, so once per climb
   and again after a reset or decay lets the count climb back. When the ruleset's optional prestige sub-rule declares
   `repeat: EACH_FURTHER_DECLINE` it also fires on each decline at or above the threshold, because that rule is the only
   repeat rule the ruleset has; with no sub-rule the event fires only on reaching. The event has no prestige effect; ticket
   T-1 06 maps it to a loss through the S-2 seam.
4. **Message.** The event projects to `messages.battle.declineThreshold.*` (BATTLE, HIGH). The strings live in the renderer's
   en-US catalogue, as for the decline message; moving them to the compiled catalogue is ticket #118's.

## Compatibility assessment

Persisted state changes additively: `wars.declineCounters` (strict `StorableDeclineCounterSchema`, optional). A save that
never declines is byte-identical and decodes unchanged, and nothing reads the tally unless a decline happened, so
`CURRENT_COMPATIBILITY_VERSION` stays `4.0.0`. No golden, content lock or replay corpus moves; the production pack authors
no `battleOffers` section.
