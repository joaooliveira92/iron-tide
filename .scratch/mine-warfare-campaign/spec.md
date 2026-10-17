# Spec: Mine warfare at campaign level

**Status:** ready-for-agent (sliced into `issues/`) · **Map:** `map.md` ·
**Decision request:** `.ai/decision-requests/0004-mine-laying-inventory-and-supply.md`

## Problem Statement

The mine-warfare engine (laying, sweeping, decay, route risk, incident reports)
is built and tested but nothing in a campaign month calls it, and no screen
shows it beyond a debug tab. A player cannot build a minelayer or minesweeper and
have it matter, cannot lose a ship to a mine, and cannot learn that an area is
mined. The manual calls minesweeping "underappreciated but vital"; today it is
absent.

## Solution

Ships whose designs carry mine gear lay mines automatically in the areas where
they are deployed, and sweeper-capable ships clear them. Each month, per-area mine
pressure rises, decays and is swept. Ships that end operational movement in
mined areas face a recorded chance of a mine strike, which damages them and
produces an incident report. The player sees their own laying and sweeping
cover, suspected enemy fields and incidents in the Diplomacy & War screen, and
the value each design and ship contributes.

## User Stories

1. As a player, I want a design with mine gear to be a real minelayer, so that my
   design choices have strategic effect.
2. As a player, I want to see a design's laying and sweeping contribution while
   designing, so that I can tune it.
3. As a player, I want destroyers and other eligible types equipped with sweeping
   gear to count as minesweepers, so that I can protect my fleet.
4. As a player, I want mine-equipped ships to lay automatically where they are
   deployed, so that I need not micromanage an abstracted activity.
5. As a player, I want deployment to decide where mines are laid, so that my
   fleet positioning matters.
6. As a player, I want mine pressure to decay over time, so that old fields lose
   danger.
7. As a player, I want sweeping in an area to reduce enemy pressure there, so that
   sweepers are worth building.
8. As a player, I want ships ending movement in mined areas to risk a strike, so
   that mines are a threat.
9. As a player, I want a struck ship to take damage and be reported, so that I see
   the consequence.
10. As a player, I want strike risk never to block movement, so that I choose my
    risks.
11. As a player, I want mine strikes sometimes mistaken for torpedo attacks, so
    that fog of war is preserved.
12. As a player, I want not to see enemy minefields directly, so that discovery
    matters.
13. As a player, I want to see my own laid pressure per area, so that I know where
    my mines are.
14. As a player, I want suspected enemy pressure from incident reports, so that I
    can route around danger.
15. As a player, I want my sweeping cover per area, so that I can judge my
    exposure.
16. As a player, I want incident reports to raise an alert, so that I notice them.
17. As a player, I want reports to show estimated cause, confidence and delay, so
    that I treat them as estimates.
18. As a player, I want the same seeds and choices to give the same strikes, so
    that replays verify.
19. As a player loading a save, I want mine state and reports restored exactly, so
    that nothing is lost.
20. As an engine developer, I want capability compiled onto the immutable design
    version, so that content edits cannot alter history.
21. As an engine developer, I want one monthly phase to own laying, decay and
    sweeping with a declared footprint, so that the phase contract holds.
22. As an engine developer, I want every strike draw recorded with stream,
    entity key and input hash, so that outcomes are auditable.
23. As an auditor, I want authoritative pressure never overwritten by reports, so
    that knowledge and truth stay separate.
24. As a release engineer, I want the state change under a compatibility bump and a
    stated golden re-pin cause, so that hash changes are deliberate.

## Implementation Decisions

Decisions are in `decisions/D1`-`D8`; summarised:

- **State:** required, area-ordered mine-pressure records in the snapshot; empty at
  1880 compile; compatibility bump (D2).
- **Capability:** laying and sweeping contributions compiled onto the design
  version from mine gear components and ship type; absent for authored ships
  without a modelled design (D3).
- **Monthly phase:** placed after movement-affecting phases and before battle
  generation; for each nation's operational ships in an area: effective laying
  value (technology, crew, readiness, damage, supply, mission multipliers from the
  engine contract) reinforces pressure against enemy belligerents; aggregated
  sweeping value is allocated and applied to pressure; decay is applied; all
  recorded as domain events. Inventory per decision request 0004 (D8).
- **No command:** laying is not a player order (D4).
- **Strike risk:** route risk from the engine feeds a recorded draw per ship and
  area; a strike damages the ship and creates an incident report; movement is
  never denied (D5).
- **Knowledge:** incident reports are immutable estimates; enemy pressure is not
  projected to the player directly (D6).
- **Surfaces:** Diplomacy & War mine-situation section, design and fleet
  contribution values, alerts count; renderer and preload stay runtime-free (D7).
- **No new ship equipment state:** ships inherit capability from design versions.

## Testing Decisions

- **One seam:** compile content, run months with the existing month executor,
  issue real commands, observe authoritative snapshot, domain events, random
  ledger and the player projection. Projection-level tests cover what the UI
  reads.
- Good tests set up through production composition, replace only external
  boundaries, and assert observable outcomes by reason code and `_tag`.
- Cover: capability compile (eligible and ineligible types, no mine gear); laying
  raises pressure only against belligerents; decay and freshness; sweeping
  reduces pressure and prioritises by strike risk; strike draws deterministic and
  recorded; reports do not alter truth; save/load; cross-process byte identity;
  presentation preferences do not alter hashes.
- Prior art: `combat/test/mines/*` (unit-level contracts, reuse their fixtures),
  construction and diplomacy month tests, cross-process determinism tests,
  desktop shell state tests.

## Out of Scope

Pre-battle mining and sweeping round; in-battle minefields; base defensive
minefields as movement limits; submarine minelaying; coastal-artillery building;
map overlay; AI laying and sweeping choices; corvette screening; the Baltic
movement block; any change to existing mine formulas or constants.

## Further Notes

- Engine constants are code-authored and their design note is unavailable
  (ADR-0210). This effort does not change them; ticket 08 records their
  provenance as an implementation baseline in `docs/research/`.
- Incident reports use the existing alerts count; a dedicated report log screen
  is deferred.
