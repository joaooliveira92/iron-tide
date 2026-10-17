# Map: S-3 Budget pressure and unrest

**Label:** wayfinder:map · **Status:** charted, all route decisions resolved;
two value/classification decisions escalated (0010, 0011).

## Destination

A spec and a ticket set for sprint S-3 (`.ai/SPRINT-PLAN.md`): a nation's unrest
level exists in authoritative campaign state, is raised and lowered by the drivers
and brakes of manual p.62 that the engine can already observe, acts as a brake on
the naval budget through strikes, can lose a war by revolution, and the budget side
of the economy moves as the manual says (3-5% growth, declining colony income, a
12% research cap). The way to implementation must be unambiguous; no
implementation happens in this effort.

## Notes

- Authority order per ADR-0210; manual pp.12-13, 16, 62, 70, 77-78 govern
  mechanics. Simulation matches Rule the Waves 3; only UI/UX may deviate.
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision is derived from a higher authority, not a gameplay
  preference; values the manual lacks are escalated, not invented.
- Lessons carried in: decision request 0006 (a required authored field and
  untouched production content are mutually exclusive) and ADR-0223 (tunable
  ruleset constants, provenance recorded) shape D2 and D7.
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): S-3 owns the unrest
  mechanism, the drivers the engine already observes, strikes, revolution, growth,
  colony income and the research cap; events and social programmes are seams.
- [D2 Unrest representation and seeding](decisions/D2-unrest-representation-and-seeding.md):
  required bounded integer on every nation with a neutral zero seed unless content
  authors one, so structure lands without production values.
- [D3 One change seam](decisions/D3-change-seam-and-drivers.md): every movement is a
  ledgered delta with a closed reason-code vocabulary; drivers are monthly phase
  inputs.
- [D4 Strikes as a budget brake](decisions/D4-strikes-budget-brake.md): crossing the
  strike threshold lowers the naval appropriation rate by a step.
- [D5 Revolution](decisions/D5-revolution.md): wartime only, a seeded draw, damped
  in liberal democracies, ends the war as a harsh loss.
- [D6 Government type](decisions/D6-government-type.md): the manual's six types,
  derived from authored political system through a ruleset mapping, never defaulted.
- [D7 Economy: growth, colonies, research cap](decisions/D7-growth-colonies-research-cap.md):
  three small independent mechanisms; manual numbers hard-coded as rules, the rest
  tunable ruleset constants.
- [D8 Production values](decisions/D8-production-values.md): escalated as decision
  requests 0010 and 0011; structural tickets use fixture-class values.

## Not yet specified

- Unrest changes from events and social programmes (S-4) beyond the named seam.
- How the AI reacts to rising unrest by cutting its own budget (A-1).
- Whether base resources shift when a peace settlement moves possessions beyond what
  the existing settlement already does.

## Out of scope

- Events catalogue, hawk/dove answers, social-programme answers (S-4).
- Democratic nations granting colonies independence (event-driven; S-4).
- Prestige consequences of strikes or revolution beyond registering a reason code
  through the S-2 seam once it lands.
- Merchant-marine and trade-protection effects on unrest (W-1).
