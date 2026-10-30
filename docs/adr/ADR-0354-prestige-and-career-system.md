# ADR-0354: Prestige and Career System

Consolidates: ADR-0225, ADR-0226, ADR-0239, ADR-0245, ADR-0260, ADR-0261, ADR-0281

Applies to: content, campaign, phase-engine, persistence, events, messages, ai, test-support

Rule: Prestige is a required nation field; every value is either grounded by RTW3 sources or an explicitly labelled balance target; the application seam is pure and dormant by default; a monthly sacking phase ends the career through a typed terminal record.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0225
Supersedes: ADR-0226
Supersedes: ADR-0239
Supersedes: ADR-0245
Supersedes: ADR-0260
Supersedes: ADR-0261
Supersedes: ADR-0281

## Context

S-2 must seed prestige per nation in 1880, apply proportional loss, sack the player at or below a threshold, and report a final score. The manual gives the rules but almost none of the numbers — the scale and every magnitude were escalated in decision request 0003.

ADR-0225 made `NationState.prestige` a required field with no engine default (not optional, nullable, silently defaulted, or derived) and gated S-2 on the 0003 research, avoiding a disposable placeholder that would cause a double golden/save movement. ADR-0226 recorded the research outcome from `docs/research/rtw3-prestige-values.md`: the prestige *model* was grounded (integer per nation, sacking threshold ≤16, proportional loss, end-of-career prestige as the career score) but almost none of the *numbers* — the fresh-start 20/19 discrepancy was unresolved. No production value was adopted, and S-2 remained blocked.

ADR-0239 resolved the impasse by the owner's delegation (Option B of decision request 0012). Grounded rules stayed binding. Every remaining magnitude became an explicit `balance_adjustment` with `BALANCE_TARGET` provenance: bounds 0–1000, fresh-start 20, per-nation 1880 start 20, battle-lost loss 500 bp, unpaid-funds loss 300 bp, gain +1 fixed, monthly sacking chance 1000 bp, final score as held prestige with no conversion. S-2 was unblocked.

ADR-0245 added `playerNationId` to `CampaignSnapshot` so prestige sources target the player deterministically from a month replay. The invariant requires `playerNationId` to equal exactly one nation with `isPlayable: true`. No migration was registered for legacy saves — earlier formats cannot identify the player unambiguously.

ADR-0260 implemented the `applyPrestigeChange` seam in phase-engine, the unpaid-funds source firing in `runObligationPhase` when an obligation shortfall exists, the `PrestigeChanged` event, and deferred the `playerNationId` state field to a month-context parameter that T-1 validates against the snapshot.

ADR-0261 added the `FIXED_LOSS` rule kind and the optional `DECLINED_BATTLE` reason code for T-1's battle-offer sub-rule. `applyPrestigeRule` and `applyPrestigeChange` take an optional explicit `rule`; without one they use `set.rules[reason]`.

ADR-0281 implemented the sacking phase before `closing_validation`, the terminal `careerResult` on `CampaignSnapshot`, the campaign-end at December 1970, and projection display of prestige state including the `PrestigeLastChange` enrichment.

## Rules

1. **Prestige field.** `NationState.prestige` is required with no engine default — never optional, nullable, silently defaulted, or derived from an unrelated field. Production 1880 content stayed untouched until the production value set was authorized (ADR-0239). The field ships under a compatibility-version bump (D2) with a deterministic migration or deliberate refusal of incompatible prior saves.

2. **Player identity.** `CampaignSnapshot` carries `playerNationId: string`, set when the campaign is created and never changed afterward. It is hashed with authoritative state and saved, loaded, cloned and replayed with it. The invariant requires `playerNationId` to equal exactly one nation in the snapshot with `isPlayable: true`. The compile/new-campaign boundary and save decoder reject violations with a typed `_tag` error. Prestige sources fire only for the player's nation. Without a player nation every prestige source is dormant and all output is byte-identical.

3. **Grounded rules are binding.** Prestige is a plain integer per nation; the sacking threshold is 16 or below and the risk is non-deterministic; loss is proportional "in most cases"; the sources of loss and gain are those the manual names; end-of-career prestige is the career score; battle victory points and career prestige are separate systems (VP never converts to prestige).

4. **Balance values are explicit.** Every ungrounded magnitude is `kind: balance_adjustment` with `sourceStatus: BALANCE_TARGET`, carries its rationale as given below, lives as a named centralized ruleset constant (ADR-0223 form), and is never presented as a sourced fact. Retuning changes the ruleset version, not code or model.

   - **Upper bound:** 1000 (balance; the highest observed career is 302, 1000 is a ceiling nothing reaches by +1 to +2 gains).
   - **Lower bound:** 0 (balance; D3 floors proportional loss at zero; play ends at 16 or below anyway).
   - **Fresh-start value:** 20 (reverse-engineered observation from most fresh saves; the player's 19 in two US 1900 saves is recorded as an unexplained anomaly and not adopted).
   - **AI prestige:** Stored for every nation, inert in S-2. AI values stay at their seed (20, matching observed RTW3 behaviour) until A-1.
   - **1880 per-nation starts:** 20 for every nation (RTW3's observed flat-20 rule, extended to the five nations with no RTW3 counterpart as balance).
   - **Loss rules:** Proportional, in basis points of current prestige, rounded up and at least 1 whenever prestige is above zero, never below zero. Battle lost 500 bp; funds unpaid 300 bp, once per month the existing negative-treasury obligation condition holds.
   - **Gain:** Fixed, not proportional: battle won +1. A tied or undecided battle changes nothing. The per-battle cap is modelled by making a gain always +1.
   - **Monthly sacking chance at 16 or below:** 1000 bp (10%). A player spending six months at the threshold is sacked about 47% of the time.
   - **Final score:** Prestige held at career end, no conversion (documented manual p.62 and observed).

5. **Seam arithmetic.** Seam arithmetic is integer: loss is `max(1, ceil(prestige * bp / 10000))` capped at the current value; gain is added and clamped to the upper bound. Changes in one month apply in the order they occur and each is an event with before, after and reason code. Reason-code vocabulary: `UNPAID_FUNDS`, `BATTLE_LOST`, `BATTLE_WON`, `DECLINED_BATTLE` (optional).

6. **Application seam.** `applyPrestigeChange(ctx, nationId, reason)` resolves the rule from the snapshot's carried `prestigeRules`, applies it with the rule layer, writes the nation's prestige and appends one `PrestigeChanged` event (`nationId`, `reasonCode`, `ruleKind`, `before`, `after`, `delta`, `rulesetVersion`). A zero applied delta writes and emits nothing. A rule that cannot be applied is a collector error (`PRESTIGE_APPLICATION_FAILED`), never a silent default. Rule kinds: `PROPORTIONAL_LOSS`, `FIXED_LOSS { amount }`, `FIXED_GAIN`. An optional explicit `rule` parameter allows battle-offer sources to supply their own rule outside the value set.

7. **Battle sources.** After the battle-resolution loop, each battle that was pending or resolving and is now resolved scores once for the month's player nation, in battle-id order: `BATTLE_LOST` when the player is the loser, `BATTLE_WON` when the winner. A null winner/loser, declined battle and non-participation change nothing. A battle that persists as resolved is never re-entered. With no player nation the source is dormant.

8. **Unpaid funds source.** In `runObligationPhase`, after a nation's treasury outputs are final, the player's nation with an obligation shortfall greater than zero (the existing `settleOutflow` condition that raises `OUTFLOW_SHORTFALL`) takes the `UNPAID_FUNDS` rule in that same month. Treasury, ledger entries and `NationBudgetChanged` are computed before and are untouched. AI-only and other nations are never changed.

9. **Sacking phase.** A new `sacking` turn phase sits immediately before `closing_validation`, so every earlier prestige source in the month counts. It acts on the player nation only. Above the threshold no draw is made. At or below it one draw is taken from the stream `prestige_sacking/<nation>/<campaignMonth>` (basis points, `[0, 10000)`), recorded in the random ledger with stream, entity key, phase, ruleset version, input hash, draw, outcome and reason code (`SACKED` or `RETAINED`). The footprint reads `nations`, `prestigeRules` and `rulesetVersion`, writes `careerResult`, and uses rng.

10. **Terminal career.** `CampaignSnapshot.careerResult` is optional; its presence is the terminal state and carries the `CareerResult` (nation, score equal to prestige at the sack, reason `SACKED`, month). It is written once. `MonthExecutor.execute` on a snapshot that holds a career result returns the unchanged snapshot, empty ledgers, `success: false` and `outcome: "career_ended"` before any phase or command runs. That is a normal outcome, not a diagnostic.

11. **Campaign end.** The same phase, when no sack ended the career, writes `CAMPAIGN_END` (score = prestige, month = the final month reached) if advancing the executing month lands on the declared final month (`isAtEnd`, December 1970, from the existing timeline). A sack and the final month coinciding yield one result: the sack wins because its draw is taken first.

12. **Projection and display.** `NationState.prestigeLastChange` (optional, written by the seam with reason, before, after, delta and month) lets the projection expose the last change after save and load. `PlayerProjection` carries prestige (current, sacking threshold, dismissal-risk flag, last change) and career. The header metric and status-strip rows state risk and result with focusable roles using externalized en-US strings.

13. **Not decided here.** These stay out of S-2 with no value chosen: war won and war lost as prestige sources; capital-ship loss; AI-prestige dynamics beyond seed; 1939 versus 1970 campaign span; Cautious extra loss and characteristic modifiers; event answers and prestige spending (S-4); declined battles (T-1); trade, presence and officer costs (later sprints). Each joins through the same seam with its own decision when its sprint needs it.

## Compatibility

Additive and dormant by default when the no player nation is supplied. The month executor context parameter (`playerNationId`) means that without a player nation every prestige source produces byte-identical output. `CURRENT_COMPATIBILITY_VERSION` bumps when the required `playerNationId` and `prestige` state fields are present in persisted snapshots (D2 bump). Migration is not attempted for legacy saves — no earlier format identifies the player unambiguously. The `PrestigeChanged` event and `careerResult` field are additive for existing snapshots that lack them.