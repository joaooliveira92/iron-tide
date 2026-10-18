# ADR-0228: The combat ship-type classifier aligns to the 1880 classification ruleset v2

## Status

Accepted (2026-10-17). Sprints: N-2. Grounded by research note
[docs/research/n-2-1880-ship-classification.md](../research/n-2-1880-ship-classification.md).

## Context

The ship-type classifier in `packages/combat/src/tactical/shipType.ts` maps an
authored `hullType` to a canonical type and applies the numeric boundaries the
compiled design exposes (`ship_type_classifier_v1`). For the four opening-era
armoured families (`monitor`, `coast_defense_ship`, `central_battery_ship`,
`ironclad_turret_ship`) its `HULL_FAMILY_MAP` floors were the manual's "B" rule:
≥5,000,000 kg, ≥6 in belt, ≥6 in gun, <20 kn.

The 1880 scenario already authors the classification ruleset it opens under:
`content/production/1880/ship-building/balance.yaml` (`ship.classification`,
ADR-0116), decoded as `DESIGN_22_EARLY` in
`packages/ship-design/src/classificationRules.ts` and exercised by
`packages/ship-design/test/scenarioClassification1880.test.ts`. That ruleset
(version 2) admits a slow, belted, heavy-gun 1860s–80s ironclad as "B" at a
lower floor than the manual's modern rule.

Seven authored 1880 designs classify as "B" under the design-side ruleset but
threw `INVALID_SHIP_TYPE` under the combat guard, so their ships could not
promote to tactical units: `des_usa_amphitrite`, `des_jpn_fuso`,
`des_nld_schorpioen`, `des_nld_buffel`, `des_por_vasco_da_gama`,
`des_bra_brasil`, `des_esp_numancia`. `CompiledDesignVersion` carries no ruleset
pointer, so the guard cannot read the scenario ruleset at runtime.

## Decision

- Bump `SHIP_TYPE_CLASSIFIER_VERSION` from `ship_type_classifier_v1` to
  `ship_type_classifier_v2`.
- Align the four opening-era armoured families to the ruleset-v2 opening band,
  shared as one constant: `minDisplacementKg` 1 500 000, `minArmorUm` 4 in
  (101 600 µm), `minCaliberUm` 6 in (152 400 µm), `maxSpeedUms` 18 kn
  (9 259 992 µm·s⁻¹).
- Leave the modern `pre_dreadnought` band at v1 (5 000 000 / 6 in / 6 in /
  20 kn). The v2 opening band is scoped to the families the 1880 scenario uses.
- The ADR-0116 design-side ruleset remains the content authority; this guard
  mirrors the fields the compiled design exposes.

## Consequences

- The seven hulls classify as "B" and promote; no commissioned, linked 1880
  ship is blocked by classification.
- Lowering a floor is monotonic for the exposed fields — a hull that classified
  under v1 cannot stop classifying — so no ship silently retypes. The one
  tightened bound is the 18 kn cap, and no present design exceeds it.
- No authoritative hash, save, or wire format changes: classification is derived
  at battle promotion and not persisted, and the division invariants already
  accept "B" for eligible roles.
- A future hull authored small under the v2 ruleset but mapped to a v1-band
  family (e.g. a <5 Mt `pre_dreadnought`) would still diverge from the guard
  until the compiled design carries a ruleset pointer. Tracked as a follow-up,
  not a v2 concern.
