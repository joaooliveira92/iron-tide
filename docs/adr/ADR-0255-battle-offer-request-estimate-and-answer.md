# ADR-0255: The battle offer: request shape, estimate, accept and delegate, typed refusals

## Status

Accepted (2026-10-21). Implements ticket
[#112](https://github.com/joaooliveira92/iron-tide/issues/112) (T-1 03) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R3 to R7, R13, R14, R15. Builds on
[ADR-0253](ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md) and
[ADR-0222](ADR-0222-turn-identity-stable-across-resume.md).

## Decision

1. **The offer is a third interruption request**, `OfferRequest` (`kind: "offer"`), beside the untouched
   `DecisionRequest` and `BattleRequest`. It carries exactly the R4 fields: mission type and acceptance class, area, the
   two sides, the player's side, the player's own force (id, name, class), the estimate (`model`, integer `strength`),
   `supportForcePresent` (always `false` until the support-force ticket), and the decline-statement message keys. The
   strict wire schema rejects any other key, so enemy ship ids or names, the battle seed, manifest and input hashes and
   draws cannot ride along.
2. **Raised in `battle_resolution`** only when the month has an interruption channel, a `playerNationId` and a
   `battleOffers` section (`MonthExecutorEngineOptions.battleOffers`), and the pending battle has a manifest whose mission
   is `FLEET_BATTLE` or `CRUISER_BATTLE` and whose attacker or defender is the player. Offers arrive in the order battles
   are processed, which is generation order (war, area, mission priority, id), so the month's auto-resolution order and RNG
   consumption are unchanged. With the section absent, the legacy battle request is raised exactly as before; every other
   battle auto-resolves.
3. **Estimate.** `estimateEnemyStrength` is a pure integer function: EXACT is the true strength, BANDED rounds it to the
   band width, PERTURBED scales it by `10000 + perturbationBp` basis points, all through a bigint intermediate with the
   stated rounding and never below zero. True strength is the summed firepower of the enemy ships in the manifest's
   committed assets. A perturbation is `draw - errorBoundBp` from the stream
   `battle-offer/estimate/<battle>/<enemy side>` and is recorded in the random ledger (stream, entity key, phase,
   ruleset version, input hash, draw, outcome, reason `BATTLE_OFFER_ESTIMATE_PERTURBED`). The input hash covers the
   manifest hash and the model, never the true strength. Composition (`showComposition`) is not shown: strength only.
4. **Accept and delegate** resume through the unchanged auto-resolution, so war score, consequences and the recorded result
   equal the non-offered run's. The answer is recorded as a new domain event `BattleOfferAnswered` (nation, battle, mission,
   `accept` or `delegate`, `AUTO_RESOLVE`), the only durable trace of the delegate intent, because state must not differ.
5. **Typed refusals.** `consumeOfferResponse` reports `OfferResponseDuplicate`, `OfferResponseOutOfOrder`,
   `OfferResponseWrongKind`, `OfferResponseStale`, `OfferResponseTampered` and `OfferResponseWrongBattle`; a decline is
   refused as `OfferDeclineUnavailable` until ticket #113. The month suspends with `invalid-input` and the same offer, and
   `SuspendedTurn.refusalTag` (optional, additive) names the tag. The desktop `submitOfferResponse` command refuses the same
   cases with the same reasons before recording anything, so the sidecar is untouched.
6. **Desktop and renderer.** The command is strict (excess keys rejected). `OfferDialog` is a Base UI alert dialog:
   labelled, described, modal, focus moves in and Escape does not dismiss it. All strings are stable `ui.offer.*` and `messages.offer.request.*` keys in the renderer's en-US catalogue
   (`lib/strings.ts`), not the compiled content catalogue, so a dormant feature moves no content and no replay header.
   The pre-existing battle dialog and its tie submission stay for the legacy `battle` request, which is raised only while
   the section is absent; removing it now would block war months in production. Ticket #118 retires it at go-live.

## Compatibility

Additive. Production authors no section, so no month raises an offer and no reference hash moves. No content changes: the
content lock, the replay corpus and `golden/hashes.json` are untouched (the offer strings stay out of the compiled
catalogue for that reason; ticket #118 may move them at go-live). `CURRENT_COMPATIBILITY_VERSION` is unchanged: no
persisted campaign state changes.
