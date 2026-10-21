# Acceptance report: T-1 battle offer flow

Status: **done and live on the production pack** (ticket 10, #119; spec #109 R16). The `battleOffers` section is authored in
`content/production/1880/rulesets.yaml` with the owner-authorized ADR-0254 balance targets (go-live: ADR-0263). Every path
below was run from a compiled production war month. No new mechanic or value is introduced by this ticket.

## Acceptance evidence

`runT1Acceptance` (`packages/cross-process-test/src/t1-acceptance.ts`) compiles the 1880 production pack, reads the section
from the compiled rulesets exactly as the desktop main process does, and drives `MonthExecutor` with a scripted interruption
channel (uk at war with france in `eng_home_coast`). The test `packages/cross-process-test/test/t1-acceptance.test.ts`
asserts the observation and that the in-process run and two clean `node` processes are byte-identical.

## Requirement coverage (R1-R16)

Verdict: **every requirement is covered by an implemented, tested ticket; no gap.**

| Req                          | Ticket(s)           | Covering tests                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 dormant section           | #111, #118          | `content-compiler/test/battleOfferRules.test.ts`, `battleOfferFromRulesets.test.ts`; `cross-process-test/test/production-pack-loop.test.ts` (production carries every ADR-0254 value, no fixture value); `production-battle-offer.test.ts` and `t1-acceptance.test.ts` (peacetime identical with the section) |
| R2 value grounding           | #110, #118          | `docs/research/t-1-battle-offer-values.md`, decisions 0028-0034, ADR-0254; `production-pack-loop.test.ts` (balance-target provenance); `t1-acceptance.test.ts` (value set and labels)                                                                                                                         |
| R3 scope, player input       | #111, #112          | `phase-engine/test/offer-response.test.ts`, `battle-offer.test.ts` (other nations auto-resolve, never-generated battle, no channel byte-identical, canonical order)                                                                                                                                           |
| R4 offer content             | #112                | `battle-offer.test.ts` (R4 fields, no enemy identity); `messages/test/interruption.test.ts`; `t1-acceptance.test.ts` (no leak, identical re-execution)                                                                                                                                                        |
| R5 estimate                  | #112                | `battle-offer.test.ts` (banding, pure integer, recorded perturbation draw inside bound)                                                                                                                                                                                                                       |
| R6 response contract         | #111, #112          | `messages/test/interruption.test.ts` (round-trip, strictness), `offer-response.test.ts`, `battle-offer.test.ts` (stale, wrong battle, tampered, duplicate, out-of-order, absent holds); `renderer/shell/useCampaignShell.test.ts` (never a null/null tie)                                                     |
| R7 accept, delegate          | #112                | `battle-offer.test.ts` (equal to the non-offered run, no VP cost); `t1-acceptance.test.ts`                                                                                                                                                                                                                    |
| R8 decline                   | #113                | `phase-engine/test/battle-decline.test.ts`; `persistence/test/declined-battle-roundtrip.test.ts`; `t1-acceptance.test.ts` (decline, unavoidable refusal)                                                                                                                                                      |
| R9 counter, event            | #114                | `phase-engine/test/decline-counter.test.ts`; `declined-battle-roundtrip.test.ts`; `t1-acceptance.test.ts`                                                                                                                                                                                                     |
| R10 prestige via S-2         | #115 (with S-2 #89) | `phase-engine/test/prestige-declined-battle.test.ts`; `campaign/test/prestige.test.ts`; `t1-acceptance.test.ts`                                                                                                                                                                                               |
| R11 enemy decline            | #116                | `combat/test/generation/enemyDecline.test.ts`, `phase-engine/test/enemy-decline.test.ts`; `t1-acceptance.test.ts`                                                                                                                                                                                             |
| R12 support force            | #117                | `combat/test/generation/supportForce.test.ts`, `phase-engine/test/support-force.test.ts`; `t1-acceptance.test.ts`                                                                                                                                                                                             |
| R13 mission types            | #112, #113          | `battle-offer.test.ts` (only FLEET_BATTLE and CRUISER_BATTLE offered); `battle-decline.test.ts` (per-mission pricing); `t1-acceptance.test.ts`                                                                                                                                                                |
| R14 presentation             | #112-#117, #118     | `renderer/shell/interruptions/OfferDialog.test.tsx`, `interruptions.test.tsx`; `desktop/src/main/uiCatalogue.test.ts`; `desktop/src/main/commands/battleOfferCommands.test.ts` (dormant without the section)                                                                                                  |
| R15 determinism, persistence | #111-#118           | `cross-process-test/test/cross-process.test.ts` (per-path two-process tests), suspend-resume equals one run in each phase-engine test, persistence round-trips; `t1-acceptance.test.ts` (in-process plus two fresh processes)                                                                                 |
| R16 non-regression, evidence | #118, #119          | `golden/` verification and replay checks (below); `t1-acceptance.test.ts`; this report                                                                                                                                                                                                                        |

## Golden hashes and cause

| Artefact                                            | Old                                                                | New                                                                | Cause                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `golden/hashes.json`                                | unchanged                                                          | unchanged                                                          | Its proof compiles a synthetic inline fixture, not the production pack.           |
| Content lock `bodyHash`                             | `1cad89c4f93466d435e3802984e2926bfc22ed2431876a6b4e995c1c0ec8f846` | `337cc1eb95624f38d0ad0a9758738e55c76ec65ba75f0484d8ee5719b5b60aa2` | Battle-offer ruleset section and T-1 UI strings authored (#118, ADR-0263).        |
| Production replays (`golden/replays`) `contentHash` | `1cad89c4...f846`                                                  | `337cc1eb...0aa2`                                                  | Same cause. Every checkpoint hash is unchanged, so no replay approval was needed. |

Migration assessment: none. Wire formats and the compatibility version are unchanged; declined records and tallies are
additive and appear only after a decline. Peacetime months are byte-identical with the section configured.

Acceptance observation hashes (darwin arm64, snapshot / events / random), identical in-process and across two processes:

| Path                            | Snapshot          | Events             | Random            |
| ------------------------------- | ----------------- | ------------------ | ----------------- |
| accept (war score 10, -10)      | `552af1bc...5c9c` | `93f5fe3d...deaea` | `716a5f55...d53c` |
| decline (-5, 0)                 | `e6d91fe9...f7e3` | `37282c2e...7d76d` | `503d5d64...6f07` |
| enemy withdraws                 | `814a810a...ba8f` | `7ad93c73...1ff0`  | `674c6ea4...e40e` |
| support force present, accepted | `846de390...3e98` | `ec384316...53bf`  | `0dfc538e...8448` |
| peacetime, section configured   | `0c39fbe0...bfe6` | `faa91c55...c7`    | `ce3f2b7e...06a2` |

## Authorized value set and provenance

All values are `kind: balance_adjustment`, `sourceStatus: BALANCE_TARGET`, authorized by the owner's delegation (ADR-0254,
Option C of decision requests 0028-0034). The manual (pp. 62, 67, 99) states that each quantity exists and gives no number.
No unsourced value was found in production.

| #   | Value           | Decision                                                                                  |
| --- | --------------- | ----------------------------------------------------------------------------------------- |
| G1  | Estimate        | PERTURBED, 2000 bp symmetric error, half-up, strength only (no composition)               |
| G2  | Decline VP      | fleet battle 5, cruiser battle 2; no distance modifier                                    |
| G3  | Opponent credit | NONE                                                                                      |
| G4  | "Several"       | threshold 3, scope WAR, reset ON_WAR_END                                                  |
| G5  | Prestige        | PROPORTIONAL_LOSS 300 bp (S-2 loss arithmetic), on each decline at or after the threshold |
| G6  | Enemy decline   | enemy strength under 5000 bp of the player's, probability 5000 bp, no enemy cost          |
| G7  | Support force   | presence 2000 bp, full existing cap (shareOfCapBp 5000), ALLIED_ONLY                      |

One structural value is not a decision: `declineVictoryPoints.rounding` is authored `HALF_UP` (the only rounding ADR-0254 states)
because the section shape requires it. It is inert, since G3 is NONE (ADR-0263).

## Observed behaviour per path

- **Offer:** FLEET_BATTLE, class OPTIONAL, area `eng_home_coast`, PERTURBED estimate with one recorded estimate draw, no composition,
  no enemy ship id, battle seed, manifest hash or input hash; the request is identical on re-execution.
- **Accept and delegate:** both complete; same final state and war score (10, -10 in the scripted month); delegate equals accept.
- **Decline:** war score (-5, 0); one terminal declined record and one `BattleDeclined` event; no battle resolved.
- **Unavoidable refusal:** `BATTLE_DECLINE_NOT_ALLOWED`; month stays suspended, score (0, 0), no record.
- **Enemy decline:** with player 400 against enemy 155 the predicate holds; seed-0 withdraws (one draw, one event, no battle, score
  (0, 0)); seed-2 proceeds to an offer. An even match makes no draw.
- **Support force:** with an allied Italy, seed-0 discloses `italy` and records one draw; seed-1 is absent; no ally, no draw.
- **Threshold and prestige:** four declines give counts 1, 2, 3, 4; threshold event on the 3rd and 4th; prestige 20, 20, 19, 18
  (3 percent, minimum 1, through the S-2 seam).

## Open observations (not blocking; the owner may revisit)

1. **G7 composition:** `ALLIED_AND_OWN_AI_DIVISIONS` acts as `ALLIED_ONLY` (ADR-0259); production authors `ALLIED_ONLY`.
2. **Inert rounding:** `declineVictoryPoints.rounding` HALF_UP changes no outcome while the opponent credit is NONE.
3. **Coastal raid ownership:** still unreachable and without a roadmap owner; convoy missions belong to W-1.
4. **Shared player-nation input:** `MonthContext.playerNationId` is shared with S-2 and departs from ADR-0245 (ADR-0260).
5. **Operational access proxy:** the support force uses the `allied` relation as its access and authorization proxy (ADR-0259).
6. **Enemy-decline predicate** compares the committed forces (ADR-0258), and an OPERATIONALLY_UNAVOIDABLE mission cannot be enemy-declined.
7. **Repeat rule:** with EACH_FURTHER_DECLINE the threshold event fires on every decline at or after the threshold (ADR-0257).
8. Open from the spec: whether the decline cost amount is shown to the player, the home-port-distance VP modifier, and offers per
   month beyond one accepted battle per area. The "intelligence coup" exemption stays with S-4.

## Known gate exception

`pnpm check` fails `check:golden-repin` over dev commit `ae33756c` (not part of T-1). On this branch it is run as
`COMMIT_RANGE=dev..HEAD pnpm check:golden-repin` and the remaining chain steps are run by hand.

## Commands and gate results

See the delivery commit message and the ticket comment for the exact results on the final commit.
