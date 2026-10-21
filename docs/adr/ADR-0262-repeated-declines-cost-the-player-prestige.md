# ADR-0262: Repeated declines cost the player prestige through the S-2 seam

## Status

Accepted (2026-10-21). Implements ticket
[#115](https://github.com/joaooliveira92/iron-tide/issues/115) (T-1 06) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R10. Consumes the seam of
[ADR-0260](ADR-0260-prestige-application-and-unpaid-funds-source.md) and the rule kind and reason code of
[ADR-0261](ADR-0261-fixed-loss-rule-and-declined-battle-reason-code.md); the tally and threshold event are
[ADR-0257](ADR-0257-declined-battle-tally-and-threshold-event.md). Rule values stay balance targets
([ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md)); tests use fixture-class values only.

## Decision

1. **Trigger.** In `applyDecline`, right after `DeclineThresholdReached` is appended (so the event and the cost share the
   crossing, and the repeat rule `ONCE_AT_THRESHOLD`/`EACH_FURTHER_DECLINE` already decides whether it fires).
2. **Seam only.** It calls `applyPrestigeChange(ctx, decliner, "DECLINED_BATTLE", rule)` with the ruleset's
   `declinedBattlePrestige.rule` (brand-checked into `SafeInt`). No prestige arithmetic, bound or event construction lives in
   T-1: the seam clamps to the S-2 bounds, writes the nation, and appends `PrestigeChanged` (nation, reason code, rule
   kind, before, after, delta, ruleset version) only for a non-zero delta.
3. **Player only.** The cost applies only when the decliner is `ctx.playerNationId`. AI nations never decline through this
   path, and the guard keeps that true by construction.
4. **Dormant.** Without the `declinedBattlePrestige` sub-rule nothing is called: the counter and event are the whole effect
   and prestige is untouched. No value set gains an entry (`DECLINED_BATTLE` is optional, ADR-0261).
5. **Footprint.** The `battle_resolution` phase already declares `nations` read and write; no footprint change.

## Compatibility

Additive and dormant: the production pack authors no `battleOffers` section, so no reference hash moves; S-2 outputs for
existing sources are untouched. No persisted state or wire shape changes.
