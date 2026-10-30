# ADR-0346: Ship Component Catalogue and Capability Model

Consolidates: ADR-0309, ADR-0311, ADR-0332, ADR-0333

Applies to: combat, content, content-schema, ship-design

Rule: The ship-component catalogue is organised by family and nation with per-record provenance, defines part families and capability kinds for all equipment eras, carries sourced or BALANCE_TARGET values, and consumes part capabilities through explicit ruleset sections.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0309
Supersedes: ADR-0311
Supersedes: ADR-0332
Supersedes: ADR-0333
Consistent with: ADR-0350

## Context

**Part families and capability kinds.** The legacy component vocabulary had `RADAR`, `SONAR`, `AA_WEAPON`, `MISSILE_LAUNCHER` and `AIRCRAFT_FACILITY` categories but no part family or capability kind could author them, and there was no anti-submarine weapon category. The 1940-1970 content could not express the equipment the manual names (pp.121-128), grounded in the audit `docs/research/e-1-era-mechanics-audit.md`.

**Component catalogue layout.** `ship-building/components.yaml` held 51 legacy components in 1674 lines: 39 guns of six navies and four generations, three torpedo tubes, nine nation-neutral fittings. It was the only single-collection file in the ship-building subtree. Provenance was hard-coded to that one path via module constants. Adding a nation or decade meant growing the same file.

**Fire-control radar.** The gunnery accuracy model had a neutral `radar` factor but nothing set it from a ship design. Part capabilities now reach combat (ADR-0308), and the radar family and capability kinds exist (ADR-0309), so a consumer with values sourced from the manual (p.121) was needed.

**1940s battleship and 16-inch gun values.** The pack had no gun above 8 inches with a modern mount, no fast-battleship form, and the United States profile capped gun calibre at 15 inches, armour at 11 inches and dock at 5,000 t. The Iowa class and 16-inch/50 gun were the documented slice of [#254](https://github.com/joaooliveira92/iron-tide/issues/254).

## Rules

### 1. Part families

Add part families `radar`, `sonar`, `asw_weapon`, `aa_weapon`, `missile_launcher` and `hangar`, each with its own interface token. Every family is an *auxiliary* part: the loadout reader places it like a fitting or sensor, and the designer catalogue lists its family-level entry. No combat behaviour is added by the family definition alone; that arrives with each consumer ticket.

### 2. Capability kinds

Add capability kinds: `search_radar`, `fire_control_radar`, `sonar_detection`, `asw_attack`, `aa_engagement`, `missile_launch` and `aircraft_hangar`.

- Radar, sonar, ASW and AA capabilities carry a `level` (1-3). The level-to-effect table is a ruleset value, not a schema constant.
- `missile_launch` carries `light_ssm`, `medium_ssm`, `heavy_ssm`, `sam` or `asm`, matching the manual's Light/Medium/Heavy ASM, SSM and SAM families (pp.121-123).
- `aircraft_hangar` carries an aircraft `capacity`; several hangars are additive.

Legacy category reconciliation: `radar` → `RADAR`, `sonar` → `SONAR`, `aa_weapon` → `AA_WEAPON`, `missile_launcher` → `MISSILE_LAUNCHER`, `hangar` → `AIRCRAFT_FACILITY`. `ASW_WEAPON` is added to the shared vocabulary (29 → 30 categories) and placed in the armament "other" tab. The two vocabularies stay identical, as their parity test requires.

No authored part values arrive with these families — the families are structural only. Adding a family with no authored part moves no content hash.

### 3. Component catalogue layout

The authored catalogue lives in `components/`, one file per family, per nation or technology generation:

| File | Contents |
|---|---|
| `guns/british-rml.yaml` | British rifled muzzle-loading guns |
| `guns/british-breech-loading.yaml` | British breech-loading guns |
| `guns/british-quick-firing.yaml` | British quick-firing guns |
| `guns/french.yaml` | French guns |
| `guns/german-krupp.yaml` | German Krupp guns |
| `guns/united-states.yaml` | United States guns |
| `torpedo-tubes/british.yaml` | British torpedo tubes |
| `torpedo-tubes/united-states.yaml` | United States torpedo tubes |
| `equipment.yaml` | Nation-neutral fittings |

Every file is listed in `pack.json`'s `shipBuilding.shipComponents`. The existing fail-closed discovery (CAH-MAN-1/2) is unchanged: an undeclared or missing file is an error.

### 4. Per-record provenance

`validate` records `componentSources` (component id → authored file) from the same declaration in `pack.json`. `compile` stamps it onto each shipped component as `sourceFile`, and the adapters (`gunPartAdapter`, `fittingPartAdapter`, `torpedoPartAdapter`) use that value for the `origin` of a derived part instead of a module constant. `ComponentDef.sourceFile` is optional so in-memory fixtures need not carry it; `LEGACY_COMPONENT_SOURCE` (`ship-building/components`) is the fallback.

Wire format: `ShipBuildingCatalogueSchema` decodes with `ShipComponentWithSourceSchema` — `ShipComponentSchema` plus an optional `sourceFile`. The authored-file schema stays strict so content YAML cannot declare its own provenance path. The change is additive; `compatibilityVersion` is unchanged.

### 5. Fire-control radar ruleset

`rulesets.yaml` gains a `gunnery.radar` section with three-level tables:
- `accuracyBpByFireControlLevel`: maps the highest `fire_control_radar.level` from the design's capabilities to the existing `radar` accuracy factor. A design with no radar keeps the neutral factor.
- `airDefenseSaturationBpBySearchLevel`: maps the best `search_radar.level` for the air-defence consumer. Populating installations on a battle manifest belongs to [#295](https://github.com/joaooliveira92/iron-tide/issues/295).
- `blindFireMinLevel`: when met, the projected battery carries `blindFireAllowed`. Gunnery resolution accepts a contact track whose `confidence` is zero for that battery only; every other battery still fails with `TACTICAL_FOG_OF_WAR_VIOLATION`. A missing track is never a legal target.

The section is optional — a pack without it keeps neutral radar behaviour. The ruleset is threaded through `MonthExecutorEngineOptions`, decoded once from the content bundle at the desktop boundary and passed to every caller (auto resolver, player-battle projection, tactical replay verifier).

Three radar parts make the effect reachable from the designer: one search set (level 2, 1940), two fire-control sets (levels 2 and 3, 1941 and 1943), authored in `ship-building/parts/radar.yaml`. Sensor slots accept the `radar` interface. Mass, cost, crew and range are balance targets derived from the optical rangefinder part.

### 6. 1940s battleship and 16-inch gun values

**Reference ship.** The Iowa class is the 1945 United States battleship starter: 262.1 m wl, 33.0 m beam, 48,110 t standard, 57,540 t full load, 212,000 shp (158,084 kW), 32.5 kn, 7,621 t of oil, three 16-inch triple turrets and ten 5-inch/38 twin mounts. It closes on its sourced full-load displacement within 50,000 kg and returns 32.5 kn.

**Gun and mount.** `gun_ap_16in_50_triple` (1943, requires `gun_16in_heavy_guns`): 406 mm bore, 50 calibres, 121,519 kg gun with breech, 1,225 kg AP Mark 8 shell, 299.4 kg charge (2,444 bp, DERIVED), 2 rounds per minute and 1,735 t triple turret. The turret splits as 578,467 kg per barrel with no fixed mass. Cost, round volume, crew, volume and footprint scale the 8-inch triple by mass and follow the ADR-0284 conventions; every unsourced value is `BALANCE_TARGET`.

**Triple-turret translation.** The legacy gun read path reclassifies a three-barrel mount as a central battery. The 16-inch triple uses the same D18 identity path as the 8-inch triple; `equivalenceReport` enumerates the three new placements, and the D17/D18 pin moves from 12 to 15 placements.

**Hull form.** `fast_battleship_form` anchored on Iowa's length and 7.94 L/B. `formBp` 8530 and `cFormX100` 24200 are fitted `BALANCE_TARGET` values; waterplane, sheer, fullness and LCB are copied from `heavy_cruiser_form`. Cost complexity is copied from `pre_dreadnought_form`.

**Profile and dock.** The United States profile raises its gun calibre ceiling to 406 mm, its armour ceiling to 432 mm, its 1940 practical-displacement band to 60,000 t and its shared dock limits to 60,000 t. A single `yard_super` (280 m, 60,000 t, 2,500 t crane) admits the hull; it is a `BALANCE_TARGET`.

No golden repin: the new content changes the content hash and therefore every replay's recorded content field, but no checkpoint moves because no replay reaches a 1943-1945 design. The 11 golden hashes are unchanged.

## Consequences

- The 1940-1970 content can now be authored without a second schema vocabulary.
- The 51 components are byte-identical after the split; only `origin.sourceFile` values differ, and every one now names a file that exists.
- Content-lock hash moves (provenance is inside the ship-building body); `golden/hashes.json` does not move because no authoritative outcome depends on a source path.
- A player design with a fire-control radar resolves gunnery with the configured factor and, at level 3, can blind-fire at a zero-confidence track.
- A player can design and build a 1940s battleship with a sourced 16-inch gun; the reference starter validates and builds.
- Part, design and placement pins move (333 parts, 97 designs, 909 placements, 264 gun placements).
- The manual's 4/8 radar-MAA limits remain a separate air-defence wiring task under [#295](https://github.com/joaooliveira92/iron-tide/issues/295).
- Retuning the radar tables or battleship values is a ruleset or content change with replay re-approval.

## Alternatives rejected

Reusing `sensor` for radar and sonar (erases the designer category and makes `RADAR`/`SONAR` unreachable); reusing `gun` for AA and ASW weapons (forces gun specification fields onto non-gun equipment); keeping one component file split only by category (still mixes navies and generations); hard-coding the per-file path in each adapter (re-splitting would silently lie about provenance); sharing formulas through YAML anchors or merge keys (aliases capped at 100, merge keys unresolved under `core` schema); moving gun values into `armament/gun-families.yaml` now (changes the armament read path and needs a sourcing pass).