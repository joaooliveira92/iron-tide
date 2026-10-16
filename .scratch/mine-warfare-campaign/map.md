# Map: Mine warfare, campaign level

**Label:** wayfinder:map · **Status:** charted; route decisions resolved; one
decision escalated.

## Destination

A spec and ticket set that makes the mine-warfare engine reachable from a
campaign month and visible to the player: ships equipped for mine laying and
sweeping shape per-area mine pressure through the monthly turn, pressure turns
into strike risk during operational movement, and the player can see what they
know and what they caused. No implementation happens in this effort.

## Notes

- Authority: manual pp.73-75 (mine warfare, minefields in battle), p.130
  (corvettes), ADR-0210 order. Simulation matches RTW3; only UI/UX may deviate.
- Engine facts: the mines module is a library of pure, tested functions; the
  monthly phase pipeline and campaign snapshot use none of it; strategic route
  risk is value-only ("no movement-blocking wired").
- Resolved without a live human (user directive). Decisions derive from the
  manual or existing contracts; behaviour the manual leaves open is escalated.
- Shares the compatibility-version bump mechanism with the S-2 prestige effort;
  whichever lands first bumps, the other joins that release.

## Decisions so far

- [D1 Scope](decisions/D1-scope.md): operational layer only; pre-battle round,
  in-battle minefields, base defensive minefields and submarine laying are later.
- [D2 State](decisions/D2-state.md): authoritative per-area mine pressure in the
  snapshot, required, compatibility-version bump.
- [D3 Capability source](decisions/D3-capability-source.md): laying and sweeping
  value compiled into the design version from MINE_GEAR parts and ship type.
- [D4 No player command](decisions/D4-no-command.md): laying is automatic per the
  manual; player influence is design, build and deployment.
- [D5 Strike risk](decisions/D5-strike-risk.md): route risk becomes a recorded
  draw on operational movement that damages ships; it never blocks movement.
- [D6 Knowledge](decisions/D6-knowledge.md): truth stays authoritative; the player
  sees own laid pressure and enemy mines only through incident reports.
- [D7 Surfaces](decisions/D7-surfaces.md): readout in Diplomacy & War, design and
  fleet contribution values; map overlay waits for the strategic map (F-1).
- [D8 Inventory](decisions/D8-inventory.md): escalated, decision request 0004.

## Not yet specified

- Corvette presence reducing strike risk for larger ships (p.130) as a sweeping
  contribution.
- AI laying and sweeping choices (A-1).
- Mines and the Baltic movement block after active mine warfare (p.15).

## Out of scope

- Pre-battle mining round and in-battle minefields (need player-fought battle,
  T-2/T-3; auto-resolution keeps the existing path).
- Defensive minefield around bases as a movement restriction.
- Submarine minelaying (W-2), coastal artillery building (p.36).
- Map overlay (F-1).
