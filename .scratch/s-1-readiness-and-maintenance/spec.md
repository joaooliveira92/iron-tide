# Spec: S-1 Ship readiness and maintenance

**Status:** ready-for-agent (sliced into `issues/`) · **Map:** `map.md` ·
**Decision requests:** `.ai/decision-requests/0007-s-1-readiness-crew-and-maintenance-values.md`
(values) and `.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`
(golden baseline for the snapshot change).

## Problem Statement

Ships in this engine have no readiness. A ship is either under construction or
operational, and maintenance is a flat cost that ignores whether it is a fully
manned active unit, a mothballed hulk, or a new ship working up. Nothing stops a
ship straight off the slipway from fighting, no crew improves or decays, repair has
no cost, and war costs no more to keep the fleet at sea than peace. The manual's
central fleet-management trade — readiness for maintenance cost, working-up ships
out of the fight — is absent, so the player cannot economise with the reserve or
mothball, and a fleet cannot degrade.

## Solution

Every commissioned ship carries a readiness state (active, reserve, mothballed,
working up) and a crew quality that ramps toward that state's ceiling. Maintenance
is charged by state, repair costs about twice active, and wartime raises the bill.
Working-up ships cannot take part in battle; reserve and mothballed ships sit out
ordinary battles but remain vulnerable to surprise attack. New ships launch into
working up and become active as their crews reach a decent standard, and the player
can move a ship between states. The player sees readiness, crew quality and what the
fleet costs each month.

## User Stories

1. As a player, I want each ship to have a readiness state I can see and set, so
   that I can trade cost against availability.
2. As a player, I want active ships to be the readiest and most expensive to run, so
   that keeping everything active has a price.
3. As a player, I want reserve and mothballed ships to cost less but take time to
   become effective, so that economising has a cost.
4. As a player, I want a newly built or newly mobilised ship to work up before it is
   effective, so that a fresh hull is not instantly battle-ready.
5. As a player, I want working-up ships excluded from battles, so that the status
   means what it says.
6. As a player, I want my crew quality to rise while a ship is active and fall when
   it is laid up, so that readiness reflects how I have kept the fleet.
7. As a player, I want crew quality to affect combat, so that training is worth the
   maintenance.
8. As a player, I want month-to-month maintenance to differ by readiness, so that
   the fleet bill is understandable.
9. As a player, I want a repairing ship to cost about twice active maintenance, so
   that damage has a sustained price.
10. As a player, I want mothballing to halt repair and its premium, so that I can
    stop the bleeding on an expensive wreck.
11. As a player, I want wartime maintenance to rise, so that war strains the budget.
12. As a player, I want reserve and mothballed ships to be catchable in a surprise
    attack, so that I cannot hide ships by laying them up.
13. As a player, I want identical choices and seeds to give identical readiness,
    crew and bills, so that replays verify.
14. As a player loading a save, I want readiness, crew quality and repair countdowns
    restored exactly.
15. As a player on any nation, I want a sourced starting readiness, so that the 1880
    fleet starts as the manual describes, not by accident.
16. As a content author, I want initial readiness derived from existing content, so
    that I do not have to author a field for every ship.
17. As an engine developer, I want one maintenance seam keyed by readiness, so that
    later sources (special training, over-base) cannot invent their own arithmetic.
18. As an engine developer, I want one admission point to read readiness, so that
    working-up exclusion cannot drift from the state.
19. As an engine developer, I want one shared maintenance formula, so that the three
    current copies cannot diverge.
20. As an auditor, I want every new authoritative field bounded and checked, so that
    crew quality and repair counts cannot leave their ranges.
21. As an auditor, I want no hidden randomness in the ramp, so that determinism is
    structural.
22. As a release engineer, I want the new state under a compatibility bump with a
    stated re-pin cause, so that hash changes are deliberate.
23. As an ARB owner, I want values the manual lacks isolated as ruleset constants, so
    that decision request 0007 can tune them without changing the model.
24. As a player with preferences, I want display settings never to change readiness
    or cost, so that presentation is not gameplay.

## Implementation Decisions

Decisions live in the map (`decisions/D1`-`D7`); summarised:

- **Representation:** required readiness state (`ACTIVE`/`RESERVE`/`MOTHBALLED`/
  `WORKING_UP`, plus `REPAIR`) and required crew-quality `0..100` on every ship;
  derived at compile (`isUnderConstruction` → `WORKING_UP`, otherwise `ACTIVE` at
  ceiling); new ships launch into `WORKING_UP`; compatibility bump; golden re-pin
  cause "new required per-ship readiness and crew state" (D2).
- **Maintenance:** the existing maintenance phase charges `base × stateMultiplier`;
  repair ~2× active; mothballed reuses the existing half rule; one shared formula for
  its three copies (D3).
- **Crew:** ramps toward the state ceiling by a ruleset rate, no RNG; feeds combat's
  `crewQualityBp` and readiness inputs (D4).
- **Battle admission:** combat generation reads real readiness; working-up excluded
  via `SHIP_WORKING_UP_BATTLE_INELIGIBLE`; reserve/mothballed out of ordinary
  battles; surprise-attack exception a named seam (D5).
- **Repair and war:** repair is a readiness state at ×2; wartime applies one ruleset
  multiplier; no transition time or one-off cost modelled (D6).
- **Values:** the absolute active rate, reserve/mothballed/wartime multipliers, crew
  ceilings and ramp, and the working-up threshold are escalated to decision request
  0007; fixture-class ruleset constants carry the structural work (D7).

## Testing Decisions

- **One seam:** compile a fixture campaign, run months with the existing month
  executor, issue real commands, and observe the authoritative snapshot, domain
  events, financial ledger and player projection. This is the highest existing seam;
  no new test seam is introduced.
- A good test sets up through production composition (compile content, run months,
  issue commands), replaces only true external boundaries, and asserts observable
  authoritative outcomes by `_tag`/reason code, not internals.
- Cover: derived seeding and bounds; maintenance differing by state and matching the
  ledger; the repair ×2 ratio and mothball halt; the wartime multiplier from a real
  war; crew ramping up and down and feeding combat inputs; working-up exclusion by
  real state; save/load restoring the fields; cross-process byte identity; the
  reference run's no-output claim for default (active) ships.
- Prior art: `packages/phase-engine/test/economy.test.ts` (maintenance/ledger),
  `.../month.test.ts` (maintenance and construction-to-fleet), `.../rebuild-projects.test.ts`
  (release/availability), `packages/combat/test/generation/eligibility.test.ts`
  (working-up/readiness exclusion), `packages/persistence/test/persistence.test.ts`
  (round-trip and version reject), `packages/ship-design/test/halt-preservation.test.ts`
  (half-mothball rule).
- Per the gate criterion: a source counts only when a test drives it from a compiled
  month.

## Out of Scope

Special training and fleet exercise; over-base deployment effects (S-5); division and
officer crew nudges (N-1/W-6); mission assignments (S-5/W-1); repair capacity, docks
and rebuild interaction; per-nation maintenance/crew differences; strategic movement
of reserve/mothballed ships; national characteristic modifiers; any change to the
1960/1970 horizon; production calibration values (decision request 0007).

## Further Notes

- Manual rules cited: pp.30, 45, 48, 51-53, 69. Only the readiness, maintenance,
  repair and working-up rules on pp.51-53 and p.69 are exercised in S-1.
- Golden hashes: the compiled snapshot changes by design; with `golden/hashes.json`
  absent the re-pin cannot be performed, so snapshot-changing tickets are gated by
  decision request 0005 (same as N-1 ticket 07).
- Compatibility: coordinate the version bump with the mine-warfare effort, whose D2
  also declares a required snapshot field ("whichever lands first bumps, the other
  joins that release").
- Risk: S-1 is not accepted until ticket 08 (values, 0007) and ticket 09 close; the
  snapshot change is not landed until 0005 resolves.
