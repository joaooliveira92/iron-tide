# ADR-0253: Battle-offer values live in a dormant ruleset section; the month takes the player nation; the offer response is an additive interruption input

Applies to: content-compiler, content-schema, messages, phase-engine

## Status

Accepted (2026-10-21). Implements ticket
[#111](https://github.com/joaooliveira92/iron-tide/issues/111) (T-1 02) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R1, R3 (player input), R6, R15.

## Context

The battle-offer mechanics (estimate, decline cost and counter, enemy decline, support force)
have no sourced values (`docs/research/t-1-battle-offer-values.md`, decisions 0028-0034). The
shapes must still exist so later tickets build against them without a production number.

## Decision

1. An optional ruleset section `battleOffers`, decoded strictly by `decodeBattleOfferRules`
   (`@bluewave/content-schema`): `sectionVersion` 1, estimate model (EXACT, BANDED, PERTURBED),
   decline victory points by mission type with a distance modifier and opponent credit, decline
   counter (threshold, scope, reset), enemy decline, support force, an optional
   declined-battle prestige sub-rule, and `provenance`. All-or-nothing; excess keys, non-integers
   and out-of-range basis points fail compile with `BATTLE_OFFER_RULES_INVALID` naming the field,
   two carriers with `BATTLE_OFFER_RULES_AMBIGUOUS`. Absent = dormant; no default exists.
   Mission-type keys are opaque ids here and are checked against the combat vocabulary by the
   consumer (#113); the distance `measure` is an opaque id until decision 0029 defines it.
2. `MonthExecutorEngineOptions.playerNationId` is the single explicit player-nation month input.
   It is validated against the snapshot before any phase runs; an unknown id fails the month with
   `PLAYER_NATION_UNKNOWN`. Nothing consumes it yet. S-2 (#89) reuses this input.
3. `OfferResponseInput { interruptionId, battleId, response: accept | decline | delegate }` is a
   new interruption kind `offer`, beside the untouched `BattleResultInput`. `consumeOfferResponse`
   hash-validates and consumes it by ordinal; it reports awaiting/invalid rather than suspending,
   because no offer request exists until #112.

## Compatibility

Additive only. The section is opaque on the ruleset manifest and absent from production, the
month option and the new input kind are optional, and no existing payload changes. Following
ADR-0231, ADR-0241 and ADR-0242, `CURRENT_COMPATIBILITY_VERSION` stays unchanged and no golden or
content lock moves.
