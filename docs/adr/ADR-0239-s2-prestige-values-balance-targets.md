# ADR-0239: S-2 prestige values: the grounded model plus labelled balance targets

Applies to: content, campaign, cross-process-test

## Status

Superseded by: ADR-0354

Accepted (2026-10-19). Resolves decision request
[0012](../../.ai/decision-requests/0012-prestige-values-unresolved-after-research.md)
(Option B), decided by the owner's delegation, which is the explicit owner
authorization R2 of spec #74 requires for any `balance_adjustment` value. Lifts the
S-2 gate set by
[ADR-0225](ADR-0225-prestige-required-field-and-research-first.md) and
[ADR-0226](ADR-0226-rtw3-prestige-research-outcome.md). Sprints: S-2.

## Context

S-2 needs prestige numbers. The 0003-B research
(`docs/research/rtw3-prestige-values.md`) grounded the prestige _model_ (an
integer, a sacking threshold of 16, proportional loss, final prestige as the
career score) but almost none of the _magnitudes_: no bounds, no per-source
fractions or gains, no sacking probability, and no 1880 start, because RTW3 has
no 1880 start. Decision request 0012 returned ten items individually. The owner
delegated the choice; Option B is adopted: keep what is grounded exactly as
sourced, and admit the rest as explicitly labelled Bluewave balance decisions, the
same path ADR-0213 and ADR-0223 took for other magnitudes the manual omits.

## Decision

**Grounded rules are binding and unchanged:** prestige is a plain integer per
nation; the sacking threshold is 16 or below (manual p.62) and the risk is a chance,
not a certainty; loss is proportional "in most cases"; the sources of loss and gain
are those the manual names; end-of-career prestige is the career score; battle
victory points and career prestige are separate systems.

**Every value below that is not grounded is a Bluewave balance decision.** It is
recorded with `kind: balance_adjustment` and `sourceStatus: BALANCE_TARGET`,
carries the rationale given here, lives as a named centralized ruleset constant
(ADR-0223 form), and is never presented as a sourced fact. The "simulation matches
RTW3" constraint is waived for these values only, and for nothing grounded above.

| # | Item | Decision | Class |
| --- | --- | --- | --- |
| 1 | Upper bound | 1000 | Balance. The highest observed career is 302; 1000 is a ceiling nothing reaches by +1 to +2 gains. |
| 2 | Lower bound | 0 | Balance. D3 floors proportional loss at zero; play ends at 16 or below anyway. |
| 3 | Fresh-start value | 20 | Reverse-engineered observation (most fresh saves). The player's 19 in two US 1900 saves is recorded as an unexplained anomaly and not adopted. |
| 4 | AI prestige | Stored for every nation, inert in S-2 | The seam is nation-agnostic; S-2 wires sources for the player nation only. AI values stay at their seed until A-1, matching the constant 20 observed for AI nations. |
| 5 | 1880 per-nation starts | 20 for every nation | RTW3's observed flat-20 rule, extended to the five nations with no RTW3 counterpart (balance). Differentiating nations would invent unsourced numbers. |
| 6 | Loss rules | see below | Balance, calibrated to the anecdotes. |
| 7 | Gain | see below | Balance, calibrated to the community's +1 to +2. |
| 8 | Monthly sacking chance at 16 or below | 1000 bp (10%) | Balance. See below. |
| 9 | Final score | Prestige held at career end, no conversion | Documented (manual p.62) and observed. |
| 10 | VP versus prestige | Kept separate; VP never converts to prestige | Documented distinction. A won or lost battle is a prestige _source_; its victory points are not. |

**Loss (item 6).** Proportional, in basis points of current prestige, rounded up and
at least 1 whenever prestige is above zero, never below zero:

- battle lost 500 bp;
- funds unpaid 300 bp, once per month the existing negative-treasury obligation
  condition holds.

Calibration: 5% reproduces the one quantified defeat in the research (about 10 at
about 195 prestige) and gives a loss of 1 at the 20 start, consistent with the small
early losses players report. Unpaid funds are named by the manual (p.13) with no
magnitude; 3% per month makes sustained insolvency reach the sacking zone within a few
months from the 20 start without one bad month being fatal.

**Gain (item 7).** Fixed, not proportional: battle won +1. A tied or undecided battle
changes nothing. Fixed gains with proportional losses make prestige hard to grow and
easy to squander, which the manual implies ("the mighty fall further") and the observed
careers (peaks near 300) suggest. The per-battle cap the community reports is modelled
by making a gain always +1.

**Sacking (item 8).** At 16 or below, once per month after that month's prestige
sources, one recorded domain-separated draw succeeds with probability 1000 bp. A
player spending six months at the threshold is sacked about 47% of the time, so the
risk is real but recoverable, and a +1 win moves them off the line. From the 20 start,
the 4-point margin to the threshold is RTW3's own design.

**Mechanics that follow.** Seam arithmetic is integer: loss is
`max(1, ceil(prestige * bp / 10000))` capped at the current value, gain is added and
clamped to the upper bound; changes in one month apply in the order they occur and
each is an event with before, after and reason code. The reason-code vocabulary is
UNPAID_FUNDS, BATTLE_LOST and BATTLE_WON, as spec #74 defines; the career ends as
SACKED or CAMPAIGN_END.

**Every value S-2 needs is accounted for.** Each is either sourced (documented RTW3,
reverse-engineered, or community, with its class above) or an owner-authorized
`BALANCE_TARGET` labelled as such. No value is unsourced and unlabelled.

**Not decided here (open observations, per spec #74).** These stay out of S-2 and no
value is chosen for them: war won and war lost, and capital-ship loss, as prestige
sources (the manual does not state them as sources); AI-prestige dynamics beyond staying
at the seed; the 1939 versus 1970 campaign span; Cautious extra loss and other
characteristic modifiers (characteristics are not modelled); event answers and prestige
spending (S-4); declined battles (T-1); trade, presence and officer costs (later
sprints). Each joins through the same seam with its own decision when its sprint needs it.

## Consequences

- **S-2 is unblocked.** Tickets 01 to 09, including ticket 08 (authoring the
  production values), may proceed. Ticket 08 authors the table above, cites this
  ADR as the accepted-decision reference for each balance value, and cites the
  research note for each grounded one.
- **Compatibility and goldens.** The new required field is the compatibility-version
  bump D2 already planned. The authoritative hashes move with an understood cause
  (a new field and new phase) and are re-pinned per
  `docs/agents/golden-repinning.md`. This ADR approves that one-time movement.
- **Tuning.** Every balance value is a ruleset constant. Retuning is a ruleset
  version change with a re-pin, not a model or code change, and should update the
  provenance note, not a source citation.
- **Honesty.** The header and status strip keep their "Not yet modelled" prestige
  row until the projection ships; nothing is shown as a number before it is real.
- **Reopening.** If a higher-trust source for any item appears, the grounded value
  replaces the balance value through a ruleset version change, and this ADR is
  amended.
