# ADR-0264: The T-1 battle-offer state keeps compatibility version 4.0.0

Applies to: content, persistence

## Status

Accepted (2026-10-21). Closes the R15 assessment of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109) left to the persistence ticket
([#113](https://github.com/joaooliveira92/iron-tide/issues/113)). Applies the policy of
[ADR-0231](ADR-0231-nation-home-area-and-possession-ownership.md) and the gate of ADR-0113.

## Decision

`CURRENT_COMPATIBILITY_VERSION` stays `4.0.0`. T-1 changed three persisted shapes:

1. `wars.declinedBattles` and `wars.declineCounters`: optional, absent until the first decline.
2. The `FIXED_LOSS` prestige rule kind in the stored rule union (ADR-0261).
3. The optional `DECLINED_BATTLE` key of the stored prestige rule set (ADR-0261).

## Assessment

- **Older saves load unchanged.** Every addition is optional or a wider union member; a save that predates them decodes with
  the keys absent and re-encodes with no such key, so its bytes and `rawHash` do not move. Evidence: the frozen 4.0.0 corpus
  fixture (`save-compatibility-corpus.test.ts`), "loads a save that never declined with the collection absent" and "stores a
  value set without DECLINED_BATTLE with no such key" (`declined-battle-roundtrip.test.ts`, `prestige-roundtrip.test.ts`).
  Nothing is defaulted, inferred or migrated, so there is no simulation ambiguity (the ADR-0231 test for "no bump").
- **New-state saves are refused, not misread, by a reader without the fields.** A `FIXED_LOSS` or unknown rule fails the
  stored union. The two new `wars` collections would be stripped by a reader that lacks them, but the semantic hash gate
  (`rawHash` over the decoded state, store integrity gate A) then differs from the stored one and the load fails. Evidence:
  "refuses, rather than silently loading, a state-bearing save whose new keys a reader without them would drop".
- **A bump would be the wrong remedy.** It would refuse every earlier 4.0.0 save, contradicting the additive policy, and it
  would move compatibility-keyed goldens for no authoritative change. The production pack authors no declined state, so no
  production save contains the new keys until a player declines.

## Consequences

No migration, no refusal path and no golden move. A later change that makes any of these fields required, or reinterprets
an existing one, needs a bump under ADR-0113.
