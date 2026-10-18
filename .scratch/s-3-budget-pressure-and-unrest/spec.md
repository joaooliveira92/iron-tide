# Spec: S-3 Budget pressure and unrest

**Status:** ready-for-agent (sliced into `issues/`) · **Map:** `map.md` ·
**Decision requests:** `.ai/decision-requests/0010-s-3-unrest-economy-values.md`,
`.ai/decision-requests/0011-s-3-government-type-classification.md`

## Problem Statement

A Grand Admiral in Rule the Waves 3 cannot spend without limit: the naval budget
presses on the workers, unrest rises, strikes demand cuts, and in a long or
blockaded war revolution loses the war. Here, nothing pushes back. The base economy
never grows, colonies pay nothing, research can take any share of the budget, and the
status strip shows "There is no domestic-politics model" where unrest belongs. The
strategic layer cannot yet punish overspending or a long war.

## Solution

Every nation carries an unrest level in authoritative state. Spending, war,
blockade, defeats, victories and cramped ships move it each month, and every move is
recorded with its reason. At the strike threshold the nation's naval appropriation
rate is pushed down, so heavy spending is self-limiting. In wartime, above the
revolution threshold, a recorded seeded draw can end the war as a harsh loss, less
likely in liberal democracies. Alongside, the economy behaves as the manual says:
base resources grow 3-5% a year, colony income declines over time, and research may
not exceed 12% of the budget, with diminishing returns above 10%. The player sees the
unrest level and what last moved it.

## User Stories

1. As a player, I want my nation's unrest level shown in the status strip, so that I
   know how close I am to trouble.
2. As a player, I want to see what raised or lowered unrest last, so that I learn
   which choices cost me.
3. As a player, I want high naval spending to raise unrest, so that I cannot spend
   without limit.
4. As a player, I want cutting spending to lower unrest, so that restraint is a real
   option.
5. As a player, I want strikes to force my appropriation rate down, so that unrest
   acts as a brake on the budget.
6. As a player, I want to raise the rate again after a strike and see unrest respond,
   so that the trade-off is visible.
7. As a player, I want unrest to dip when a war breaks out and climb as it drags on,
   so that long wars cost me.
8. As a player, I want a blockade to raise my unrest, so that losing sea control
   hurts at home.
9. As a player, I want defeats to raise unrest and victories to lower it, so that
   battle results reach the home front.
10. As a player, I want cramped ships to add unrest while I am at war or blockaded,
    so that weight saved in design has a cost.
11. As a player, I want revolution to be able to end a war I am losing at high unrest,
    so that I am warned to seek a negotiated peace.
12. As a player in a liberal democracy, I want revolution to be less likely, so that
    my government type matters.
13. As a player, I want a revolution to be a recorded loss with harsh terms, so that
    it is a consequence and not a crash.
14. As a player, I want my base economy to grow 3-5% a year, so that budgets rise
    over a long campaign.
15. As a player, I want colony income to decline over the decades, so that holding
    colonies is not a free benefit forever.
16. As a player, I want research limited to 12% of my budget, so that I cannot
    starve the fleet for technology.
17. As a player, I want research above 10% to give diminishing returns, so that the
    last percent is a real trade-off.
18. As a player, I want AI nations to obey the same unrest, strike and revolution
    rules, so that the world is consistent.
19. As an auditor, I want every unrest change to carry a stable reason code, ruleset
    version and before/after, so that any month can be explained.
20. As an auditor, I want revolution draws recorded with stream identity and inputs,
    so that outcomes replay exactly.
21. As a designer, I want every magnitude centralised as a ruleset constant with
    provenance, so that balance can change without touching phases.
22. As a content author, I want unrest seeds and colony values to be optional and
    neutral when absent, so that content can be authored incrementally.
23. As a content author, I want an unmapped political system to fail compilation with
    a diagnostic, so that no nation silently gets the wrong government type.
24. As a later-sprint author, I want reserved event and social-programme reason codes,
    so that S-4 plugs in without new arithmetic.
25. As a maintainer, I want presentation preferences never to change unrest or
    budgets, so that U-5 invariance still holds.

## Implementation Decisions

- Unrest is a required bounded integer per nation, seeded from optional authored
  content with a neutral floor (map D2); bounds and thresholds are ruleset constants.
- One change operation moves unrest by closed-vocabulary reason, with checked integer
  arithmetic and a domain event; reason codes `EVENT` and `SOCIAL_PROGRAMME` are
  reserved (D3).
- A dedicated monthly unrest phase runs after battle resolution and before the next
  revenue; it evaluates drivers in a fixed order and applies strikes (D3, D4).
- Strikes lower the existing naval appropriation rate by a ruleset step, within its
  existing bounds (D4).
- Revolution: wartime only, domain-separated seeded draw, liberal-democracy damping
  factor, ends the war as a loss via the existing peace-settlement path with a
  severity multiplier (D5).
- Government type: the manual's six, derived from authored political system by a
  ruleset mapping; an unmapped system is a compile diagnostic (D6).
- Economy: an economic-growth phase before revenue; colony income from optional
  possession values with time decay; research capped at 12% of the naval budget with a
  diminishing-returns curve above 10% (D7).
- The player projection exposes unrest and its last structured reasons using the
  structured explanation data of ADR-0221; the renderer stays runtime-free.
- Compatibility version bumps for the new state and phases; the reference run moves,
  so goldens are re-pinned only per `docs/agents/golden-repinning.md`, never to make a
  gate pass.
- Production numbers are authored only in the last structural ticket after owner
  decisions 0010 and 0011 (D8).

## Testing Decisions

- A good test drives a compiled campaign month through the production composition and
  observes authoritative state and the domain event stream; it asserts external
  behaviour (levels, rates, events), not phase internals.
- Highest seam: the monthly campaign step over a fixture campaign, observing
  snapshot, events and the player projection. No new seams.
- Determinism: revolution draws and growth replay to identical hashes; cross-process
  reference run covers the new state.
- Boundary decoding: saves and content decode strictly; a parity test per schema change
  built from existing fixtures.
- Prior art: the S-1 and S-2 ticket tests, the monthly-revenue and research phase
  tests in the phase-engine package, and the U-5 invariance test for presentation.

## Out of Scope

- Event catalogue and social-programme answers (S-4); independence grants to colonies.
- AI goal-directed reaction to unrest (A-1); trade-protection effects (W-1).
- Prestige consequences beyond a reason code through the S-2 seam.

## Further Notes

- S-3 is planned to depend on S-2; this slice avoids needing it. The only link is a
  reserved prestige reason code, so S-3 may proceed while S-2 is gated on 0003.
- Anything the manual lacks (scale, thresholds, magnitudes, per-nation growth, colony
  values, 1880 government classification) is researched or escalated, not invented.
