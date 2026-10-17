# Spec: S-2 Prestige and career

**Status:** ready-for-agent (sliced into `issues/`) · **Map:** `map.md` ·
**Decision request:** `.ai/decision-requests/0003-prestige-scale-and-values.md`

## Problem Statement

A Grand Admiral in Rule the Waves 3 plays to keep their post. Here, nothing the
player does costs or earns standing: there is no prestige, so no defeat, unpaid
payroll or lost war can end a career, and no run has a score. The strategic layer
cannot yet produce "a game you can lose". The header and status strip show a
placeholder where prestige belongs.

## Solution

Every nation carries a prestige value in authoritative state, seeded from
authored 1880 content. Real events already in the engine move it: running out of
funds, losing a battle or capital ship, and winning or losing wars. Losses are
proportional, so the mighty fall further. When the player's prestige is at or
below 16 each month carries a recorded chance of being sacked, which ends the
career. A career that ends, by sacking or by reaching the 1939 horizon, produces
a result whose score is the prestige held. The player sees current prestige and
why it last changed.

## User Stories

1. As a player, I want my nation's prestige shown in the header, so that I know my
   standing at a glance.
2. As a player, I want to see why prestige last changed, so that I can learn which
   of my choices cost me.
3. As a player, I want unpaid funds to lower my prestige, so that overspending has a
   consequence.
4. As a player, I want a lost battle to lower my prestige, so that defeat matters.
5. As a player, I want losing a capital ship to lower my prestige, so that careless
   losses matter.
6. As a player, I want a won battle to raise my prestige, so that success is
   rewarded.
7. As a player, I want a won war to raise and a lost war to lower prestige, so that
   campaign outcomes carry weight.
8. As a player, I want higher prestige to cost more when lost, so that standing
   is something I can squander.
9. As a player with prestige at 16 or below, I want to be warned I risk dismissal,
   so that I can react.
10. As a player, I want a chance each month of being sacked at or below 16, not a
    certainty, so that recovery is possible.
11. As a player who is sacked, I want the campaign to end clearly with my final
    score and reason, so that I understand what happened.
12. As a player who reaches the 1939 horizon in office, I want a final score, so
    that my career is measured.
13. As a player, I want identical choices and seeds to give identical prestige and
    outcomes, so that the game is fair and replays verify.
14. As a player loading a save, I want prestige and any career result restored
    exactly, so that nothing is lost.
15. As a player on any nation, I want a sourced starting prestige, so that nations
    start differently by authority, not by accident.
16. As a content author, I want starting prestige authored per nation in YAML and
    rejected at the boundary when missing or out of range, so that bad content
    cannot compile.
17. As a content author, I want fixture content to exercise prestige without
    shipping fixture numbers in production, so that tests do not become canon.
18. As an engine developer, I want one seam for every prestige change with a reason
    code, so that later sources (events, presence, trade, officers) cannot invent
    their own arithmetic.
19. As an engine developer, I want every change recorded as a domain event with
    before and after, so that replays and reports can explain it.
20. As an engine developer, I want sacking to use a recorded domain-separated draw,
    so that determinism and audit hold.
21. As an auditor, I want the final result recorded in authoritative state, so that
    scoring cannot depend on presentation.
22. As an AI-nation owner (A-1 later), I want AI nations to carry prestige too, so
    that goal-directed AI can read it.
23. As a release engineer, I want the new field under a compatibility-version bump
    and re-pinned goldens with a stated cause, so that hash changes are
    deliberate.
24. As a player, I want presentation preferences never to change prestige, so that
    display settings are not gameplay.

## Implementation Decisions

Decisions live in the map (`decisions/D1`-`D6`); summarised:

- **State:** required branded safe-integer prestige on every nation; bounded;
  authored per nation in 1880 content; compile-boundary validation with excess
  keys rejected; compatibility-version bump (D2).
- **Single change seam:** one operation taking nation, reason code and either
  proportional loss (basis points of current) or fixed gain; integer arithmetic,
  explicit rounding, floor at the lower bound; emits a domain event with before,
  after, reason, ruleset version (D3). Reason codes are a closed, stable
  vocabulary; later sprints add codes through the seam.
- **Sources in S-2:** unpaid funds (existing negative-treasury obligation
  condition), battle lost, capital ship lost, battle won, war won, war lost (D1).
  Reason codes distinguish them. Gains and losses are ruleset constants.
- **Sacking:** new monthly phase after battle resolution and before closing
  validation; player nation only; threshold 16 from the manual; seeded
  domain-separated draw recorded with stream identity, entity key, input hash,
  draw, outcome, reason; terminal career state stops commands and months (D4).
- **Career result:** nation, final score (prestige at end), reason (SACKED or
  HORIZON_REACHED), month; authoritative; Hall of Fame persistence out of scope
  (D5).
- **Projection:** player projection exposes prestige, last change and reason,
  and sack-risk flag; header and status strip consume it and drop their
  placeholders; renderer and preload stay runtime-free.
- **Production values:** escalated to decision request 0003; production content
  and ruleset values are authored only after it resolves (D6). Fixture-class
  values carry the structural work.
- **Characteristics not modelled:** national characteristic modifiers (for
  example Cautious extra loss) are not applied until characteristics exist.

## Testing Decisions

- **One seam:** drive a compiled campaign snapshot through months with the
  existing month executor and observe authoritative snapshot, domain events,
  random ledger and career result. This is the highest existing seam; no new test
  seam is introduced. A projection-level test covers what the UI reads.
- A good test sets up state through production composition (compile content, run
  months, issue real commands), replaces only external boundaries, and asserts
  observable authoritative outcomes by `_tag`/reason code, not internals.
- Cover: seeding and boundary rejection; proportional loss rounding and bounds;
  each source from a real trigger; sacking draw determinism (same seed, same
  outcome; recorded fields); terminal state refuses further commands; horizon
  result; cross-process byte-identical runs; presentation preferences do not alter
  hashes.
- Prior art: construction/financial ledger tests, diplomacy and war-score tests,
  cross-process determinism tests, content-compiler per-field boundary tests,
  desktop shell state tests.
- Per the gate criterion: a source counts only when a test drives it from a
  compiled month.

## Out of Scope

Events and hawk/dove answers and prestige spending (S-4); unrest/budget pressure
(S-3); readiness (S-1); foreign stations (S-5); battle offer and decline cost (T-1);
trade protection (W-1); officer prestige costs (W-6); national characteristic
modifiers; Hall of Fame persistence and screen; any change to the 1960/1970
horizon; production calibration values (decision request 0003).

## Further Notes

- The manual's rules cited: pp.12-13, 46, 58-59, 61-62, 67, 70-72. Only
  pp.12-13 and 58-62 are exercised in S-2.
- Golden hashes: the compiled 1880 snapshot changes by design; re-pin per the
  golden repinning doc with cause "new required prestige state".
- Risk: ticket 08 depends on an external-source decision; structural tickets are
  complete without it, but S-2 is not accepted until 08 and 09 close.
