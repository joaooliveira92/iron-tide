# ADR-0281: The sacking phase and the terminal career

Applies to: campaign, phase-engine

## Status

Superseded by: ADR-0354

Accepted (2026-10-23). Implements tickets [#90](https://github.com/joaooliveira92/iron-tide/issues/90) (S-2 05) and
[#91](https://github.com/joaooliveira92/iron-tide/issues/91) (S-2 06) and
[#92](https://github.com/joaooliveira92/iron-tide/issues/92) (S-2 07) and
[#93](https://github.com/joaooliveira92/iron-tide/issues/93) (S-2 08) of spec
[#74](https://github.com/joaooliveira92/iron-tide/issues/74), R6 to R9 and R11. Uses the value set of
[ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md) and the seam of
[ADR-0260](ADR-0260-prestige-application-and-unpaid-funds-source.md) unchanged.

## Decision

1. **Battle sources.** After the battle-resolution loop, each battle that was pending or resolving at the start of the phase
   and is now resolved scores once for the month's player nation, in battle-id order: `BATTLE_LOST` when the player is the
   loser, `BATTLE_WON` when the winner. A null winner and loser, a declined battle and non-participation change nothing.
   A battle that persists as resolved is never re-entered, so it is never re-scored. With no player nation the source is
   dormant.
2. **Sacking phase.** A new `sacking` turn phase sits immediately before `closing_validation`, so every earlier prestige source
   in the month counts. It acts on the player nation only. Above the threshold no draw is made. At or below it one draw is
   taken from the stream `prestige_sacking/<nation>/<campaignMonth>` (basis points, `[0, 10000)`), recorded in the random
   ledger with stream, entity key, phase, ruleset version, input hash, draw, outcome and reason code (`SACKED` or
   `RETAINED`). The footprint reads `nations`, `prestigeRules` and `rulesetVersion`, writes `careerResult`, and uses rng.
3. **Terminal career.** `CampaignSnapshot.careerResult` is optional; its presence is the terminal state and carries the
   `CareerResult` of the rule layer (nation, score equal to prestige at the sack, reason `SACKED`, month). It is written once.
   `MonthExecutor.execute` on a snapshot that holds a career result returns the unchanged snapshot, empty ledgers,
   `success: false` and `outcome: "career_ended"` before any phase or command runs. That is a normal outcome, not a diagnostic.

4. **Campaign end.** The same phase, when no sack ended the career, writes `CAMPAIGN_END` (score = prestige, month = the final
   month reached) if advancing the executing month lands on the declared final month (`isAtEnd`, December 1970, from the
   existing timeline; no new date and no span decision). A sack and the final month coinciding yield one result: the sack wins
   because its draw is taken first and ends the career in the executing month. Only the player nation has a career, so
   without a player nation nothing is written.
5. **Persistence and the desktop.** The save schema accepts an optional `careerResult`; a snapshot without one is unchanged,
   so no compatibility bump. The desktop turn transaction rejects a month on an ended career with `CAREER_ENDED`.

6. **Projection and display.** `NationState.prestigeLastChange` (optional, written by the seam with reason, before, after, delta and
   month) lets the projection expose the last change after save and load. `PlayerProjection` carries `prestige` (current,
   sacking threshold, dismissal-risk flag, last change) and `career`. The header metric and the status-strip rows state risk and
   the result in words, with a focusable status role, using externalized en-US strings.

## Compatibility

Absent while the career is active, so existing snapshots, goldens and reference hashes do not move (`pnpm check:golden`
unchanged).
