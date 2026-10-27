# ADR-0261: A fixed-loss prestige rule and an optional DECLINED_BATTLE reason code

Applies to: phase-engine, campaign, persistence

## Status

Accepted (2026-10-21). Seam extension for T-1 [#115](https://github.com/joaooliveira92/iron-tide/issues/115) (spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109) G5), authorised by the owner as option A of the #115
blocker. Builds on [ADR-0260](ADR-0260-prestige-application-and-unpaid-funds-source.md). Adds no prestige value.

## Decision

1. **Rule kind.** `FIXED_LOSS { amount }` joins `PROPORTIONAL_LOSS` and `FIXED_GAIN`: `after = max(lowerBound, current -
   amount)`, `delta` the amount actually applied. It matches the kind the battle-offer sub-rule
   `declinedBattlePrestige.rule` already allows. A value-set decode accepts it with `amount` in `0..span`.
2. **Reason code.** `DECLINED_BATTLE` joins `PRESTIGE_REASON_CODES`. The value-set requirement is split:
   `REQUIRED_PRESTIGE_REASON_CODES` (the three ADR-0239 sources) stay mandatory, while `OPTIONAL_PRESTIGE_REASON_CODES`
   (`DECLINED_BATTLE`) may be authored and is otherwise absent. Absent means dormant: the key is left out of the decoded
   set, the persisted snapshot and every hash, and no default is ever substituted.
3. **Where the rule comes from.** The T-1 sub-rule is authored in the battle-offer section, not in the prestige value
   set. `applyPrestigeRule` and `applyPrestigeChange` therefore take an optional explicit `rule`; without one they use
   `set.rules[reason]`, and with neither the result is `PrestigeRuleMissing` (a collector error in a phase), never a
   fallback. #115 passes `battleOffers.declinedBattlePrestige.rule`.
4. **Wire.** `PrestigeChanged.reasonCode` gains `DECLINED_BATTLE` and `ruleKind` gains `FIXED_LOSS`; the persisted rule
   union accepts `FIXED_LOSS` and the optional `DECLINED_BATTLE` key.

## Compatibility

Additive. The production value set, content, content lock and compatibility version (`4.0.0`) are untouched; no
reference hash moves because nothing authors or applies `DECLINED_BATTLE` until #115 and #118. Existing sources produce
byte-identical results.
