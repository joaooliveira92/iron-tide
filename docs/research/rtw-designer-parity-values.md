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

| Constant / magnitude | Introduced by | Status | Field grounded by | Authored in |
| --- | --- | --- | --- | --- |
| `DECK_EXTENDED`, `TURRET_TOP`, `SECONDARY_GUN` starting thicknesses and sizing | #154 | BALANCE_TARGET | manual pp.37, 135 (fields only) | `ArmourBalance` / `START_THICKNESS_UM`, `newArmourRegion` |
| `BARBETTE → TURRET` merge rule | #154 | DERIVED | — (migration rule) | `persistence.ts` migration |
| `kWeightRelBp`, `kReliabilityBp`, `kCostBp` (engine priority) | #155 | BALANCE_TARGET | manual p.41 (axis only) | `MachineryBalance` |
| `ENGINE_RELIABILITY_LOW` threshold | #155 | BALANCE_TARGET | — | design findings thresholds |
| Fire-control-position warning/critical thresholds | #156 | BALANCE_TARGET | manual p.135 (field only) | `SystemsBalance` |
| Per-position fire-control degradation curve | #156 | BALANCE_TARGET | — | `SystemsBalance` |
| Per-calibre gun quality values | #156 | DERIVED | manual p.135; read-only | `GUN_QUALITY_TABLE` (combat, research data) |
| Low-freeboard reduction | #157 | BALANCE_TARGET | manual p.39 (toggle only) | hull `Balance` |
| Low-freeboard hull-weight saving | #157 | BALANCE_TARGET | — | hull `Balance` |
| Tertiary battery weight / topside / bearing fraction | #157 | BALANCE_TARGET | manual p.28 (count only) | `WeaponsBalance` / topside balance |
| Scheme thickness patterns (all schemes) | #159 | BALANCE_TARGET | manual pp.38–39 (names only) | armour scheme catalogue |

## Notes

- The manual is authority order 3 (ADR-0210) for **mechanics and terminology**; it
  is not authority for scope or for our balance magnitudes.
- No constant here may be labelled VERIFIED or sourced in content or UI copy.
