# Decision Request: Prestige scale and production values (S-2)

## Status

Resolved (2026-10-17) — owner chose **Option B** (research against high-trust
external sources before authoring production prestige values). Blocks only S-2
ticket 08 until the research produces adequately sourced values; tickets 01-07
proceed on fixture-class values and do not depend on it. See the owner decision
below.

## Trigger

Sprint S-2 ("Prestige and career") must seed prestige per nation in 1880, apply
proportional loss, sack the player at or below the threshold, and report a final
score. The manual gives the rules but none of the numbers needed to run them.
Inventing them would fabricate canonical gameplay information (AGENTS.md stop
condition; ADR-0210 "values the manual lacks are researched or escalated").

## Evidence

- Manual p.12, p.61-62: prestige is raised by naval victories and "tough" event
  answers, lowered by "soft" answers, defeats and mismanagement; loss is "in most
  cases proportional"; "16 or below" risks being sacked; prestige at the end is a
  "victory points" career score saved to a Hall of Fame.
- Manual p.13: running out of funds lowers prestige. p.46: missing naval presence
  may cost prestige. p.58: removing or hurrying officers costs prestige. p.67:
  several declined battles may cost prestige. p.70-72: unmet trade protection may
  cost prestige. p.59-60: "Cautious" nations risk extra loss on lost battles and
  capital ships.
- The manual states **no** scale or starting value, loss fraction per source, gain
  per source, per-month sacking probability below the threshold, or final-score
  formula. `grep` of the full extracted text for "prestige", "sacked", "score",
  "Hall of Fame" finds only the passages above.
- `docs/research/rtw3-manual-baseline.md` records the same limits.
- Engine today: no prestige field on nation state; the desktop header and status
  strip render a placeholder ("No prestige mechanic exists in the campaign yet").

## Why agent judgment is insufficient

Different numbers change who gets sacked and when, so they change authoritative
outcomes and every downstream golden hash. The project's rule is that simulation
behaviour matches Rule the Waves 3 (deviations confined to UI/UX), so a
plausible-looking invented calibration is a silent gameplay divergence.

## Options

### Option A: Owner supplies the values

- Behavior: owner provides the scale, per-nation 1880 starts, loss fractions, gain
  magnitudes, sacking probability and score rule, with a source.
- Advantages: fastest; unambiguous authority.
- Risks: owner may not have the original game data to hand.
- Compatibility impact: none until adopted; then a new baseline.
- Migration impact: none (no prior prestige state).
- Scope and effort: one ticket (08) plus an ADR.

### Option B: Research against high-trust external sources (recommended first)

- Behavior: run the `research` skill for observed original-game behaviour
  (official patch notes, developer posts, game data files where lawfully
  readable), recording each value with its citation in `docs/research/`. Values
  with no source stay unresolved and come back here individually.
- Advantages: stays faithful to the source game; AFK; no new authority invented.
- Risks: sources may be partial or contradictory; some values may stay unknown.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: one research ticket, then ticket 08.

### Option C: Declare a Bluewave calibration

- Behavior: choose values for playability, record them as a deliberate divergence
  in an ADR, and tune with the balance sweep.
- Advantages: unblocks completely; tunable.
- Risks: breaks the "simulation matches RTW3" constraint; needs explicit owner
  acceptance; may need re-tuning when S-3/S-4 land.
- Compatibility impact: values become part of the ruleset version.
- Migration impact: later re-tuning changes authoritative outcomes (golden
  re-pin).
- Scope and effort: one ADR plus ticket 08.

## Recommendation

Option B now, with unresolved residue returning here for A or C. Do not
implement production values before approval; tickets 01-07 use fixture-class
rulesets only.

## Work safely completed while blocked

Everything structural in S-2 (state, seeding mechanism, ledger and proportional
loss primitive, source hooks for unpaid funds and war/battle outcomes, sacking
phase, career result, projection and UI) is specified as tickets 01-07 using
fixture-class constants that never ship in the production pack.

## Owner decision (2026-10-17)

**Chosen:** Option B — conduct research against high-trust external sources
before authoring production prestige values. Recorded in
[ADR-0225](../../docs/adr/ADR-0225-prestige-required-field-and-research-first.md).

**Authorized production values or rules.** Research the prestige scale and
bounds, per-nation 1880 starting values, loss fractions by source, gain
magnitudes by source, monthly sacking probability below the applicable
threshold, and the final-score rule. Record every adopted value with a citation
in `docs/research/` and the required ADR. Return every unresolved or
contradictory value to the owner individually. Do not substitute a Bluewave
calibration, fixture value, placeholder, inferred value, or undocumented
approximation.

**Additional constraints.** Research must distinguish directly documented RTW3
behavior from historical analogues, community observations, reverse-engineered
observations, and Bluewave balance decisions. No production prestige value may
be committed until its provenance is explicit. Decision 0003-B authorizes
research only; it does not authorize unsourced production values.
