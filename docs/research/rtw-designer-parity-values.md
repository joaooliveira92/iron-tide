# Ship-designer parity: new constants and their provenance

Status: new research note authored 2026-10-18 for wayfinder map
[#152](https://github.com/joaooliveira92/iron-tide/issues/152) task ticket
[#162](https://github.com/joaooliveira92/iron-tide/issues/162), companion to the
manual audit `docs/research/rtw-designer-audit.md`
([#153](https://github.com/joaooliveira92/iron-tide/issues/153)). It records
the provenance of every magnitude the map's model decisions
([#154](https://github.com/joaooliveira92/iron-tide/issues/154)–#159) introduce.

## Conclusion

The RTW3 manual names the **fields** (armour regions, engine priority, fire-control
positions, freeboard preset, tertiary count, schemes) but states **no number** for
any of them (audit §4, "Must remain BALANCE TARGET"). Every magnitude below is
therefore an admitted **BALANCE_TARGET** (ADR-0213) and must never be presented as
a sourced historical fact. The two exceptions are **derived**, not invented: the
engine-priority trade is a monotone adjustment of existing plant data, and
per-calibre gun quality already exists as research/combat data.

## Table

Every row is a **BALANCE_TARGET** unless marked DERIVED. "Value" is what the 1880
ruleset authors today; none of it is sourced.

| Constant | Value | Introduced by | Field grounded by | Authored in |
| --- | --- | --- | --- | --- |
| `START_THICKNESS_UM` for `DECK_EXTENDED` / `TURRET` / `TURRET_TOP` / `SECONDARY_GUN` | 50 / 150 / 50 / 75 mm | #154 | manual pp.37, 135 (fields only) | `packages/ship-design/src/armour.ts` |
| Starting sizes of the same regions (length x height) | extended deck: waterline - citadel x deck width; turret 6 x 2.5 m; turret top 4 x 4 m; secondary 3 x 2 m | #154 | — | `newArmourRegion` |
| `BARBETTE` / `TURRET_FACE` to `TURRET` merge rule | per-field maximum; material and incline from the thicker plate; tie by smaller material id | #154 | — (migration rule) | `persistence.ts` (`foldLegacyTurretRegions`) |
| `enginePriorityWeightSwingBp` | 1500 | #155 | manual p.41 (axis only) | `balance.yaml` `machinery` |
| `enginePriorityPowerSwingBp` | 500 | #155 | — | `balance.yaml` `machinery` |
| `enginePriorityReliabilitySwingBp` | 2500 | #155 | — | `balance.yaml` `machinery` |
| `enginePriorityReliabilityWarnBp` (breakdown-risk warning) | 7000 | #155 | — | `balance.yaml` `machinery` |
| `fireControlPositionRedundancyBp` (per position, capped at 10 000) | 2500 | #156 | manual p.135 (field only) | `balance.yaml` `systems` |
| `FIRE_CONTROL_NO_POSITIONS` threshold | 0 positions with directors and guns fitted | #156 | manual p.135 | `systems.ts` (no tunable) |
| Per-calibre gun quality | -3..+2 on the combat scale; DERIVED | #156 | manual p.135; read-only | `GUN_QUALITY_TABLE` (combat). **No research source assigns a quality to a calibre today**, so the panel reports the neutral value 0 and says so. |
| `lowFreeboardReserveCutBp` | 3000 | #157 | manual p.39 (toggle only) | `balance.yaml` `hull` |
| `lowFreeboardHullWeightSavingBp` | 400 | #157 | — | `balance.yaml` `hull` |
| `tertiary.gunWeightNanoKgPerMm3` | 1 500 000 (57 mm gun ~ 278 kg) | #157 | manual p.28 (count only) | `balance.yaml` `tertiary` |
| `tertiary.footprintFactorPermille` | 400 000 (57 mm gun ~ 1.3 m2 of deck) | #157 | — | `balance.yaml` `tertiary` |
| `tertiary.shellNanoKgPerMm3` | 20 000 (57 mm shell ~ 3.7 kg) | #157 | — | `balance.yaml` `tertiary` |
| `tertiary.bearingBp` (share of guns bearing on one beam) | 5000 | #157 | — | `balance.yaml` `tertiary` |
| Tertiary calibre choices offered | 47, 57, 76.2 mm | #157 | — | `BatteryPanel.tsx` |
| Scheme layouts (which belt/deck regions each fits) | see `ARMOUR_SCHEMES` | #159 | manual pp.38-39 (names only) | `packages/ship-design/src/armourSchemes.ts` |
| Scheme unlock years: Belt and sloping deck / All or nothing | 1905 / 1912 | #159 | manual pp.38-39 (gated only) | `armourSchemes.ts` |
| Shaft horsepower | kW x 10 000 / `kwPerShpBp` (7457) | #158 | — | `presentation-format/power.ts`; DERIVED, display only |

## What is deliberately not modelled yet

- The engine-priority trade has no cost term (the spec allows "both directions may
  raise cost"); weight, delivered power and reliability are the modelled axes.
- Combat hit-location weights are not folded for the removed barbette zone; the
  `BARBETTE` zone type stays dormant in the armour contract (no rebalance).
- Design-similarity (`study.ts`) does not yet count `DECK_EXTENDED`, `TURRET_TOP` or
  `SECONDARY_GUN`.
- Gun quality has no per-calibre data source (see the table).

## Notes

- The manual is authority order 3 (ADR-0210) for **mechanics and terminology**; it
  is not authority for scope or for our balance magnitudes.
- No constant here may be labelled VERIFIED or sourced in content or UI copy.
