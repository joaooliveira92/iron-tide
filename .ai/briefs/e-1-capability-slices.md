# E-1 capability slices: radar, sonar, missiles, air groups

Design brief for [#278](https://github.com/joaooliveira92/iron-tide/issues/278), [#279](https://github.com/joaooliveira92/iron-tide/issues/279),
[#280](https://github.com/joaooliveira92/iron-tide/issues/280), [#281](https://github.com/joaooliveira92/iron-tide/issues/281),
[#282](https://github.com/joaooliveira92/iron-tide/issues/282) and [#283](https://github.com/joaooliveira92/iron-tide/issues/283), from
`.ai/reports/e-1-era-mechanics-audit.md`. Written 2026-10-25 after tracing the code; the findings below were verified, not assumed.

## Finding: no part capability reaches combat

A part capability follows this path today: `content-schema` `CapabilitySchema` -> `ship-design` part catalogue -> `loadoutResolution`
attribute -> the armour and compile stages. It stops there. `CompiledDesignVersion` (`packages/campaign/src/state.ts`), the only design
record combat reads, carries no capability or attribute data, so a `damage_control` capability never affects a battle, and a radar part
could not either. Every sensor, weapon-family and hangar slice below therefore needs the same enabling seam first.

## Slice 0: carry capabilities from the compiled design into combat (blocks all others)

- Add an optional, canonically ordered `capabilities` list to `CompiledDesignVersion`, copied by the compile stage from the resolved loadout.
  Additive and optional, so ADR-0264 keeps the compatibility version; a schema parity test from existing fixtures is required.
- `designs` are hashed in the campaign snapshot, so every design that gains a capability moves hashes. Designs with none must not, and
  the 1880 production designs carry none, so the 13 replays and 11 goldens must stay byte-identical; the PR proves it.
- First consumer: scale damage control resources by the design's `damage_control` capability, so an existing capability finally acts.
- Tests: compile-stage unit test, persistence round trip, combat projection test, replay and golden unchanged.

## Slice per issue (minimum player-visible value)

| Issue         | Minimum slice                                                                                                                                                                                | Depends on                                                      | Notes                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #283 families | one ADR, then one schema ticket per family: radar (search, fire control), sonar and surface ASW weapon, AA gun and missile launcher, hangar                                                  | Slice 0 for consumers                                           | Schema, catalogue decode, designer tab and parity tests only; no combat change in the schema tickets                                                                                  |
| #279 radar    | `search_radar` and `fire_control_radar` capabilities with a level; combat sets the existing neutral `radar` accuracy factor from the best fire-control level, and level 3 permits blind fire | Slice 0, radar family                                           | Values come from a ruleset block; the manual (pp.121, 127) grounds the mechanic and gives no accuracy figure, so values are balance targets                                           |
| #281 missiles | SSM only (light, medium, heavy), era 1955 onward: a launcher family and a new `combat` missile module with its own contract, state and resolution                                            | Slice 0, launcher family                                        | SAM and ASM are separate follow-ups; a new module is a new authoritative surface, so it needs its own ADR and replay coverage                                                         |
| #282 ASW      | surface ASW attack (depth charge, ahead-throwing weapon) against submarines in a battle                                                                                                      | W-2 decision of ADR-0300 (submarines are dormant)               | Blocked on the submarine wiring, not on schema. Direction from sources: ahead-throwing weapons killed roughly one submarine in five attacks against one in 60 to 80 for depth charges |
| #280 air      | populate `airGroups` and `airDefenseInstallations` on the battle manifest from carrier and hangar state                                                                                      | Slice 0, hangar family, aviation technology ids (#278 children) | CV, CVL and AV ship types must also get a `requiresTech` so they stop reading as unavailable                                                                                          |

## #278 remainder

Heavy-jet carrier operations, controlled mines, mine-laying submarines, missile submarines and the aviation prerequisite have no catalogue
technology. Each needs a dated, sourced technology following the existing `provenance` format, an unlock era consistent with the roadmap,
and a drift test, split by domain: carriers and aviation, mines, and submarines.

## Research record

- Surface ASW kill rates: HistoryNet and Wikipedia (secondary) report about one kill per five Hedgehog attacks against one in 60 to 80
  for depth charges in 1942-45. Reliability: secondary; use for direction only.
- Radar: sources found describe the Type 284 and 285 sets and the Matapan night action qualitatively; none gives a gunnery accuracy
  figure. Reliability: secondary; no figure is adopted.
- Missiles, sonar, mine-laying and missile submarines: not researched beyond the manual pages cited in the issues. The research step is
  part of each slice.
