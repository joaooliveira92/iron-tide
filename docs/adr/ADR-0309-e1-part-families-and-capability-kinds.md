# ADR-0309: E-1 part families and capability kinds for radar, sonar, ASW, AA, missiles and hangars

Applies to: combat, content-schema, ship-design

## Status

Accepted (2026-10-26) for [#289](https://github.com/joaooliveira92/iron-tide/issues/289),
[#290](https://github.com/joaooliveira92/iron-tide/issues/290) and
[#291](https://github.com/joaooliveira92/iron-tide/issues/291), part of
[#283](https://github.com/joaooliveira92/iron-tide/issues/283) under
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Grounds the families in the manual
(pp.121-128) as recorded in [`e-1-1940-1970-timeline.md`](../research/e-1-1940-1970-timeline.md) and
the audit [`e-1-era-mechanics-audit.md`](../../.ai/reports/e-1-era-mechanics-audit.md).

## Context

`PART_FAMILIES` could express guns, mounts, ammunition, torpedoes, propulsion, armour, sensors and
fittings only. The legacy component vocabulary already had `RADAR`, `SONAR`, `AA_WEAPON`,
`MISSILE_LAUNCHER` and `AIRCRAFT_FACILITY`, but no part family or capability kind could author them,
and there was no anti-submarine weapon category. The 1940-1970 content therefore could not express
the equipment the manual names.

## Decision

1. **Families and placement interfaces.** Add part families `radar`, `sonar`, `asw_weapon`,
   `aa_weapon`, `missile_launcher` and `hangar`, each with its own interface token. They are
   *auxiliary* parts: the loadout reader places them like a fitting or sensor, and the designer
   catalogue lists their family-level entry. No combat behaviour is added by this ADR.
2. **Capability kinds.** Add `search_radar`, `fire_control_radar`, `sonar_detection`, `asw_attack`,
   `aa_engagement`, `missile_launch` and `aircraft_hangar`.
   - Radar, sonar, ASW and AA capabilities carry `level` 1-3. The manual grounds the direction:
     fire control "from level 3 will allow blind fire" (p.121), and more than 4 radar-directed
     medium AA has diminishing returns and more than 8 is redundant (p.127). The level-to-effect
     table is a ruleset value for the consumer ticket (#292), not a schema constant.
   - `missile_launch` carries `light_ssm`, `medium_ssm`, `heavy_ssm`, `sam` or `asm`, matching the
     manual's Light/Medium/Heavy ASM, SSM and SAM families (pp.121-123).
   - `aircraft_hangar` carries an aircraft `capacity`, so several hangars are additive.
3. **Legacy category reconciliation.** `radar` maps to `RADAR`, `sonar` to `SONAR`, `aa_weapon` to
   `AA_WEAPON`, `missile_launcher` to `MISSILE_LAUNCHER`, and `hangar` to `AIRCRAFT_FACILITY`. An
   anti-submarine weapon has no legacy category, so `ASW_WEAPON` is added to the shared
   `SHIP_COMPONENT_CATEGORIES` / `COMPONENT_CATEGORIES` vocabulary (29 → 30) and placed in the
   armament "other" tab. The two vocabularies stay identical, as their parity test requires.
4. **No authored values in this ADR.** The families are structural; the actual parts and their
   dates/values arrive with the decade content tickets (#254, #256, #258), where each value is
   sourced or labelled `BALANCE_TARGET`. Adding a family with no authored part moves no content
   hash.
5. **Persistence.** The strict design decoder of ADR-0308 accepts the new capability kinds, so a
   later design carrying radar or a hangar round-trips. The save compatibility version stays 4.0.0
   for the same additive reason.

## Consequences

- The 1940-1970 content can now be authored without a second schema vocabulary.
- `pnpm check:golden`, the 13 replays, `content:verify` and the content lock are unchanged because
  no production part uses a new family.
- `#292` (radar), `#293` (missiles), `#295` (air) and `#296` (ASW) now have the schema seam they
  need; each remains responsible for its own ruleset values and reachability evidence.

## Alternatives rejected

- **Reuse `sensor` for radar and sonar.** It would erase the designer category and make the
  existing `RADAR`/`SONAR` vocabulary unreachable.
- **Reuse `gun` for AA and ASW weapons.** Their mounts, feeds and effects differ; a gun family would
  force gun specification fields onto equipment the engine does not model as a gun.
- **Author parts in the schema tickets.** Dates and values would be invented before their sourcing
  tickets.
