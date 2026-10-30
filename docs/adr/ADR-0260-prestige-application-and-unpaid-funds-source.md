# ADR-0260: Prestige application seam and the unpaid-funds source

Applies to: events, messages, phase-engine

## Status

Superseded by: ADR-0354

Accepted (2026-10-21). Implements ticket [#89](https://github.com/joaooliveira92/iron-tide/issues/89) (S-2 04) of spec
[#74](https://github.com/joaooliveira92/iron-tide/issues/74), R4 and R5. Uses the value set of
[ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md) unchanged. Departs from one detail of
[ADR-0245](ADR-0245-player-nation-id-in-campaign-state.md) (see decision 2).

## Decision

1. **Seam.** `applyPrestigeChange(ctx, nationId, reason)` (phase-engine, `prestigeApplication.ts`) resolves the rule from the
   snapshot's carried `prestigeRules`, applies it with the S-2 rule layer (`applyPrestigeRule`), writes the nation's
   prestige and appends one `PrestigeChanged` event (`nationId`, `reasonCode`, `ruleKind`, `before`, `after`, `delta`,
   `rulesetVersion`). A zero applied delta writes and emits nothing. A rule that cannot be applied is a collector error
   (`PRESTIGE_APPLICATION_FAILED`), never a silent default. The caller decides whether a source fires and for which nation;
   the owning phase declares the `nations` read and write in its footprint. No randomness is consumed.
2. **Player identity.** The source fires only for `MonthContext.playerNationId`, the explicit month-executor input that
   T-1 ([#111](https://github.com/joaooliveira92/iron-tide/issues/111), spec #109 R3) already validates against the
   snapshot. ADR-0245 chose a state field, but that field was never implemented and storing it would move the
   compatibility version and every golden for a source this ticket only needs to target. With no player nation supplied
   the source is dormant and every output is byte-identical to before. If ADR-0245's state field lands later, the
   context value is simply read from it; the seam does not change.
3. **Unpaid funds.** In `runObligationPhase`, after a nation's treasury outputs are final, the player's nation with an
   obligation shortfall greater than zero (the existing `settleOutflow` condition that already raises
   `OUTFLOW_SHORTFALL`) takes the `UNPAID_FUNDS` rule in that same month. Treasury, ledger entries and
   `NationBudgetChanged` are computed before and are untouched. AI-only and other nations are never changed.
4. **Footprint.** The obligation phase's footprint gains `nations` (read, write) beside `treasury`, because prestige lives
   on the nation record. No other phase footprint moves.
5. **Event wire.** `PrestigeChanged` is a new strict event body (excess keys rejected) with a message projection. The
   `reasonCode` and `ruleKind` literals mirror the campaign vocabulary because `events` does not import it.

## Compatibility

Additive and dormant by default. No persisted state, content or ruleset value changes; `CURRENT_COMPATIBILITY_VERSION`
stays `4.0.0`. Reference hashes do not move: production months in the repository run without a player nation.
